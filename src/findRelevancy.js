"use strict";
const parse = require('git-diff-parser');
const fs = require('fs');

/**
 * Find relevancy between the current state of the commit and one other commit
 * @param {String} diffFile .diff for commit being checked for relevancy
 * @param {String} userFile current file user is editing
 * @param {Date} commitTime time when commit was made, use "git log -1 --format=%ci [commit hash]""
 * @param {String} authorName author of commit
 * @param {Int} startLine first line in user's current viewing window
 * @param {Int} endLine last line in user's current viewing window
 * @param {Float[]} mults array representing all the current relevancy settings 
 * in the order of author, time, location. (and any future metrics)
 * @param {string} stdout standard output stream
 *
 * @returns length 2 array:
 * index 0: float representing relevancy of current commit 
 * (over all the files changed) with 1 being very relevant and 0 being not relevant at all
 * index 1: Length 10 array of pairs showing the top 10 most relevant lines out of 
 * all the lines changed
 */

function findRelevancy(diffFile, userFile, commitTime, authorName, startLine, endLine, mults, stdout) {
    console.log("Finding relevancy...");
    try{
    let authorMult = mults[0];
    let timeMult = mults[1];
    let locationMult = mults[2];

    //Handle time since independent of actual changes
    let latestTime = new Date('2025-04-13 15:40:18 -0700'); //just using the very first commit made
    let curTime = new Date();
    let timePassedScaled = (1 - (curTime - commitTime) / (curTime - latestTime)) * timeMult;

    let relevancy = [0, timePassedScaled, 0]; //[author, time, location]

    //const diff = fs.readFileSync(stdout, 'utf8');
    let parsed = parse(stdout);

    if (parsed['commits'].length === 0) {
        console.error("No changes found in commit: ", error);
        return [0, []];
    }
    


    //console.log(parsed['commits'].length);

    const standard = parsed['commits'][0]['files'];

    let author = 0;
    let location = 0;
    let numAuthorLines = 0;
    let numLocationLines = 0;

    let bestLines = {};
    let fileNames = {};
    //console.log("LENGTH: ", standard[0].length);

    for (let curFile = 0; curFile < standard.length; ++curFile) {
        const fileName = standard[curFile]['name'];
        const lines = standard[curFile]['lines'];
        const filteredLines = lines.filter(line => line.type !== 'normal');

        let blameAuthors = getBlameAuthors(fileName.split('/').pop() + "_blame.txt"); 
        
        let totalFileLines = lines.length;
        numAuthorLines += lines.filter(line => line.type === 'deleted').length;
        numLocationLines += filteredLines.length;

        for (let i = 0; i < filteredLines.length; ++i) {
            let curChange = filteredLines[i];
            let curLine = curChange['ln1'];
            let lineContent = curChange['text'];
            lineContent = curChange['type'] === 'deleted' ? '- ' + lineContent : '+ ' + lineContent;
            let curLineEval = [0, timePassedScaled, 0]; //author, time, location
            
            //author check
            if (curChange['type'] === 'deleted') {
                author += blameAuthors[curLine] === authorName ? 1 : 0;
                curLineEval[0] += blameAuthors[curLine] === authorName ? 1 : 0;
            }

            //location calculation
            if (fileName === userFile) {
                if (curLine >= startLine && curLine <= endLine) {
                    location += 1;
                    curLineEval[2] += 1;
                } else if (curLine < startLine) {
                    location += 1 - ((startLine - curLine) / startLine);
                    curLineEval[2] += 1 - ((startLine - curLine) / startLine);
                } else {
                    location += 1 - ((curLine - endLine) / (totalFileLines));
                    curLineEval[2] += 1 - ((curLine - endLine) / (totalFileLines));
                }
            }

            bestLines[lineContent] = Math.sqrt(curLineEval[0]**2 + curLineEval[1]**2 + curLineEval[2]**2) / Math.sqrt(3);
            fileNames[lineContent] = fileName;
        }
    }
    
    relevancy[0] = numAuthorLines === 0 ? 0 : author / numAuthorLines * authorMult;
    relevancy[2] = numLocationLines === 0 ? 0 : location / numLocationLines * locationMult;

    //standard L2 distance normalized between 1 (close -> very relevant) and 0 (far -> irrelevant)
    const dist = Math.sqrt(relevancy[0]**2 + relevancy[1]**2 + relevancy[2]**2) / Math.sqrt(3);
    console.log(relevancy);


    //sort dictionary
    var items = Object.keys(bestLines).map(function(lineContent) {
        return [bestLines[lineContent], [fileNames[lineContent], lineContent]];
    });

    items.sort(function(first, second) {
        return second[0] - first[0];
    });
    const result = [dist, items.slice(0, 10).map(item=>item[1])];
    return result;
    }catch (err) {
        console.error("Unable to find relevant lines in findRelevancy(): ", err);
        return [0, []];
    }
}

/**
 * 
 * @param {String} filePath path to the blame file
 * @returns array of strings of author names in the order of lines
 */
//git blame [filename] > blame.txt
function getBlameAuthors(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    let authors = [null];

    lines.forEach((line) => {
        const startIndex = line.indexOf('(');
        const substringAfterParenthesis = line.slice(startIndex + 1).trim();
        const author = substringAfterParenthesis.split(' ')[0].replace(/\x00/g, '');
        authors.push(author);
    });

    return authors;
}


module.exports = {findRelevancy, getBlameAuthors};