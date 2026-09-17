import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const csvPath = path.join(__dirname, 'data', 'Round_1_Profiles.csv');
const outputPath = path.join(__dirname, 'public', 'teams.json');

const teamCounts = {};

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
    fs.writeFileSync(outputPath, JSON.stringify({ teams: teamsArray }));
    console.log(`Done. Written ${teamsArray.length} teams to public/teams.json`);
  })
  .on('error', (err) => {
    console.error('Error reading CSV:', err);
    process.exit(1);
  });
