/**
 * Find relevancy between the current state of the commit and one other commit
 * @param {String} diffFile .diff file for current commit
 * @param {String} userFile current file user is editing
 * @param {Date} commitTime time when commit was made, use "git log -1 --format=%ci [commit hash]""
 * @param {String} authorName author of commit
 * @param {Int} startLine first line in user's current viewing window
 * @param {Int} endLine last line in user's current viewing window
 * @param {Float[]} mults array representing all the current relevancy settings 
 * in the order of author, time, location. (and any future metrics)
 * 
 * @returns length 2 array:
 * index 0: float representing relevancy of current commit 
 * (over all the files changed) with 1 being very relevant and 0 being not relevant at all
 * index 1: Length 10 array of pairs showing the top 10 most relevant lines out of 
 * all the lines changed
 */

function findRelevancy(diffFile, userFile, commitTime, authorName, startLine, endLine, mults) {
    let authorMult = mults[0];
    let timeMult = mults[1];
    let locationMult = mults[2];

    //Handle time since independent of actual changes
    let latestTime = new Date('2025-04-13 15:40:18 -0700'); //just using the very first commit made
    let curTime = new Date();
    let timePassedScaled = (1 - (curTime - commitTime) / (curTime - latestTime)) * timeMult;

    let relevancy = [0, timePassedScaled, 0]; //[author, time, location]

    //general setup
    const fs = require('fs');
    const parse = require('git-diff-parser');

    const diff = fs.readFileSync(diffFile, 'utf8');

    const parsed = parse(diff);

    //let startLine = 30; //using placeholders as current viewing window for now
    //let endLine = 50;

    const standard = parsed['commits'][0]['files'];
    let author = 0;
    let location = 0;
    let numAuthorLines = 0;
    let numLocationLines = 0;

    let bestLines = {};

    for (let curFile = 0; curFile < standard.length; ++curFile) {
        const fileName = standard[curFile]['name'];
        const fileContent = standard[curFile];
        const lines = standard[curFile]['lines'];
        const filteredLines = lines.filter(line => line.type !== 'normal');

        //let blameAuthors = getBlameAuthors(fileName); 
        //this wouldn't work directly since I can't call git in a .js file, but 
        //should work fine when integrated into the main files
        
        let totalFileLines = lines.length;
        numAuthorLines += lines.filter(line => line.type === 'deleted').length;
        numLocationLines += filteredLines.length;

        for (let i = 0; i < filteredLines.length; ++i) {
            let curChange = filteredLines[i];
            let curLine = curChange['ln1'];
            let lineContent = curChange['text'];
            let curLineEval = [0, 0]; //author, location
            
            //author check
            if (curChange['type'] === 'deleted') {
                //author += blameAuthors[curLine] === authorName ? 1 : 0;
                //curLineEval[0] += blameAuthors[curLine] === authorName ? 1 : 0;
            }

            //location calculation
            if (fileName === userFile) {
                if (curLine >= startLine && curLine <= endLine) {
                    location += 1;
                    curLineEval[1] += 1;
                } else if (curLine < startLine) {
                    location += 1 - ((startLine - curLine) / startLine);
                    curLineEval[1] += 1 - ((startLine - curLine) / startLine);
                } else {
                    location += 1 - ((curLine - endLine) / (totalFileLines));
                    curLineEval[1] += 1 - ((curLine - endLine) / (totalFileLines));
                }
            }

            bestLines[lineContent] = Math.sqrt(curLineEval[0]**2 + curLineEval[1]**2) / Math.sqrt(2);
        }
    }

    relevancy[0] = author / numAuthorLines * authorMult;
    relevancy[2] = location / numLocationLines * locationMult;

    console.log(relevancy);

    //standard L2 distance normalized between 1 (close -> very relevant) and 0 (far -> irrelevant)
    const dist = Math.sqrt(relevancy[0]**2 + relevancy[1]**2 + relevancy[2]**2) / Math.sqrt(3);

    //sort dictionary
    var items = Object.keys(bestLines).map(function(key) {
        return [key, bestLines[key]];
    });

    items.sort(function(first, second) {
        return second[1] - first[1];
    });

    return [dist, items.slice(0, 10)];
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

console.log(findRelevancy("test.diff", "src/CommitViewer.ts", new Date('2025-04-24 20:40:18 -0700'), 'autecht', 30, 50, [0.5, 0.3, 0.8]));