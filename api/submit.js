import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Octokit } from 'octokit';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName, members } = req.body;

  if (!teamName || !members || members.length === 0) {
    return res.status(400).json({ error: 'Team name and members are required.' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_ORG = process.env.GITHUB_ORG;
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const repoName = `Round2-${teamName.trim().replace(/[^a-zA-Z0-9-]/g, '-')}`;

  try {
    // 1. Check if repo exists (Duplicate Check)
    let repoExists = false;
    let owner = null;
    if (GITHUB_TOKEN) {
      try {
        if (GITHUB_ORG) {
            owner = GITHUB_ORG;
        } else {
            const userResp = await octokit.request('GET /user');
            owner = userResp.data.login;
        }
        await octokit.request(`GET /repos/${owner}/${repoName}`);
        repoExists = true;
      } catch (e) {
        if (e.status !== 404) {
          console.error("Error checking repo existence:", e);
        }
      }
    }

    if (repoExists) {
      return res.status(400).json({ 
        error: 'This team has already been registered! The GitHub repository has already been sent to all members. Please check your emails, accept the invitation, and continue building in the repository.' 
      });
    }

    // 2. Validate against CSV Data
    const validEmails = await new Promise((resolve, reject) => {
      const emails = [];
      let foundTeam = false;
      const csvPath = path.join(process.cwd(), 'data', 'Round_1_Profiles.csv');
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const tName = row['Q1: Team Name'] || row['Team Name / Candidate Name'];
          const email = row['Candidate\'s Email'] || row['Team Leader\'s Email / Candidate\'s Email'];
          
          if (tName && tName.trim() === teamName.trim() && email) {
            foundTeam = true;
            emails.push(email.trim().toLowerCase());
          }
        })
        .on('end', () => resolve(foundTeam ? emails : null))
        .on('error', reject);
    });

    if (!validEmails) {
      return res.status(400).json({ error: 'Team name not found in the approved list for Round 2.' });
    }

    for (const member of members) {
      if (!validEmails.includes(member.email.toLowerCase())) {
        return res.status(400).json({ 
          error: `Data mismatch: Email ${member.email} is not registered as a member of team "${teamName}".` 
        });
      }
    }

    // 3. Create GitHub Repository and Add Collaborators
    if (!GITHUB_TOKEN) {
      console.log('No GITHUB_TOKEN provided. Simulating repo creation for local dev...');
    } else {
      let createResponse;
      if (GITHUB_ORG) {
          createResponse = await octokit.request('POST /orgs/{org}/repos', {
            org: GITHUB_ORG,
            name: repoName,
            description: `Repository for team ${teamName} for Round 2`,
            private: false,
            auto_init: true
          });
      } else {
          createResponse = await octokit.request('POST /user/repos', {
            name: repoName,
            description: `Repository for team ${teamName} for Round 2`,
            private: false,
            auto_init: true
          });
      }

      owner = createResponse.data.owner.login;

      for (const member of members) {
        if (member.githubUsername) {
          try {
            await octokit.request('PUT /repos/{owner}/{repo}/collaborators/{username}', {
              owner: owner,
              repo: repoName,
              username: member.githubUsername,
              permission: 'push'
            });
          } catch(err) {
            console.error(`Failed to add ${member.githubUsername} to repo:`, err.message);
          }
        }
      }
    }

    // 4. Send Custom Email
    if (EMAIL_USER && EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
      });

      const mailOptions = {
        from: EMAIL_USER,
        to: members.map(m => m.email).join(','),
        subject: `Round 2 Repository Created for ${teamName}!`,
        text: `Hello Team ${teamName},\n\nYour repository has been successfully created. You must have received a separate email directly from GitHub inviting you to collaborate on the repository.\n\nPlease accept that invitation and start building there!\n\nBest of luck for Round 2!`,
      };

      await transporter.sendMail(mailOptions);
    } else {
      console.log('No EMAIL credentials provided. Skipping custom email sending.');
    }

    return res.status(200).json({ success: true, message: 'Form submitted successfully! Repositories created and emails sent.' });

  } catch (error) {
    console.error('Error processing submission:', error);
    return res.status(500).json({ error: 'An error occurred while creating the repository or sending emails. Please contact support.' });
  }
}
