import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const teams = await new Promise((resolve, reject) => {
      const teamCounts = {};
      const csvPath = path.join(process.cwd(), 'data', 'Round_1_Profiles.csv');
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const tName = row['Team Name / Candidate Name'] || row['Q1: Team Name'];
          if (tName) {
            const name = tName.trim();
            teamCounts[name] = (teamCounts[name] || 0) + 1;
          }
        })
        .on('end', () => {
          const teamsArray = Object.keys(teamCounts).map(name => ({ name, size: teamCounts[name] }));
          resolve(teamsArray);
        })
        .on('error', reject);
    });

    // Return the array of unique team names
    return res.status(200).json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return res.status(500).json({ error: 'Failed to fetch team list' });
  }
}
