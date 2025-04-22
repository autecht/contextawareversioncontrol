let authorMult = 0.5;
let timeMult = 0.8;
let locationMult = 0.9;

//Handle time since independent of actual changes
let commitTime = new Date('2025-04-16 12:19:08 -0700'); //get this using git log -1 --format=%ci [commit hash]
let latestTime = new Date('2025-04-13 15:40:18 -0700'); //just using the very first commit made
let curTime = new Date();
let timePassedScaled = (1 - (curTime - commitTime) / (curTime - latestTime)) * timeMult;

let relevancy = [0, timePassedScaled, 0]; //[author, time, location]

//general setup
const fs = require('fs');
const readline = require('readline');
const parse = require('git-diff-parser');

const diff = fs.readFileSync('test.diff', 'utf8');

const parsed = parse(diff);

let blameAuthors = getBlameAuthors('blame.txt');

let startLine = 30; //using placeholders as current viewing window for now
let endLine = 50;

const lines = parsed['commits'][0]['files'][0]['lines'];
const filteredLines = lines.filter(line => line.type !== 'normal');

let authorName = 'autecht';
let author = 0;
let location = 0;
let totalFileLines = lines.length;
let numAuthorLines = lines.filter(line => line.type === 'deleted').length;
let numLocationLines = filteredLines.length;

//console.log(numAuthorLines);
//console.log(numLocationLines);
//console.log(filteredLines);

for (let i = 0; i < filteredLines.length; ++i) {
    let curChange = filteredLines[i];
    let curLine = curChange['ln1'];
    
    //author check
    if (curChange['type'] === 'deleted') {
        author += blameAuthors[curLine] === authorName ? 1 : 0;
    }

    //location calculation
    if (curLine >= startLine && curLine <= endLine) {
        location += 1;
    } else if (curLine < startLine) {
        location += 1 - ((startLine - curLine) / startLine);
    } else {
        location += 1 - ((curLine - endLine) / (totalFileLines));
    }
}

relevancy[0] = author / numAuthorLines * authorMult;
relevancy[2] = location / numLocationLines * locationMult;

//outputs
console.log(relevancy);

//standard L2 distance normalized between 0 (close -> very relevant) and 1 (far -> irrelevant)
const dist = Math.sqrt(
    [1, 1, 1].reduce((sum, value, index) => sum + Math.pow(value - relevancy[index], 2), 0)
) / Math.sqrt(3);

console.log(dist);

//Handle git blame to be used later for author relevancy
//this should also be realistically done once before starting relevancy calculation
//not for each individual comparison
//git blame [filename] > blame.txt
function getBlameAuthors(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
  
    let authors = [null];
  
    lines.forEach((line) => {
        const startIndex = line.indexOf('(');
        const substringAfterParenthesis = line.slice(startIndex + 1).trim();  // trim to remove leading spaces
        const author = substringAfterParenthesis.split(' ')[0].replace(/\x00/g, '');
        authors.push(author);
    });

    return authors;
}
