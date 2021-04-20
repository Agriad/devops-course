const core = require('@actions/core');
const github = require('@actions/github');
var atob = require('atob');
const { Context } = require('@actions/github/lib/context');

/**
 * Creates a nested list to represent the students
 * @param {string} studentListText A string of students
 * @returns {Object} A 2D list of students and values
 */
function createDataStructure(studentListText) {
    let names = studentListText.split("\n");
    names.pop();
    names.sort();
    let dataStructure = [];

    names.forEach(name => {
        let data = [name + "@kth.se", 0];
        dataStructure.push(data)
    });

    return dataStructure
}

async function getAllReadme(octokit, owner, repoName, ref) {
    const projects = ["course-automation", "demo", "essay", "executable-tutorial", "feedback", "open-source"];
    let textArray = [];

    // for (let i = 0; i < projects.length; i++) {
    //     let categoryPayload = await getFile(octokit, owner, repoName, "contributions/" + projects[i], ref);
    //     let categoryGroups = categoryPayload.data;

    //     for (let j = 1; j < categoryGroups.length; j++) {
    //         let groupPayload = categoryGroups[j];
    //         let groupName = groupPayload.name;

    //         let readmePayload = await getReadme(octokit, owner, repoName, "contributions/" + "feedback" + "/" + groupName, ref);
    //         let readmeContentBase64 = readmePayload.content;
    //         let readmeContent = atob(readmeContentBase64);
    //         console.log(readmeContent);
    //     }
    // }

    let contributions = await getFile(octokit, owner, repoName, "contributions", ref);
    console.log(contributions);

    projects.forEach(category => {
        console.log("contributions/" + category);
    });

    let categoryPayload = await getFile(octokit, owner, repoName, "contributions/" + projects[4], ref);
    let categoryGroups = categoryPayload.data;

    for (let j = 1; j < categoryGroups.length; j++) {
        let groupPayload = categoryGroups[j];
        let groupName = groupPayload.name;

        let readmePayload = await getReadme(octokit, owner, repoName, "contributions/" + "feedback" + "/" + groupName, ref);
        let readmeContentBase64 = readmePayload.content;
        let readmeContent = atob(readmeContentBase64);
        console.log(readmeContent);
    }

    // let categoryPayload = await getFile(octokit, owner, repoName, "contributions/" + "feedback", ref);
    // let categoryGroups = categoryPayload.data;

    // for (let j = 1; j < categoryGroups.length; j++) {
    //     let groupPayload = categoryGroups[j];
    //     let groupName = groupPayload.name;

    //     let readmePayload = await getReadme(octokit, owner, repoName, "contributions/" + "feedback" + "/" + groupName, ref);
    //     let readmeContentBase64 = readmePayload.content;
    //     let readmeContent = atob(readmeContentBase64);
    //     console.log(readmeContent);
    // }

    // let presentationTextArray = [];
    // let presentationPayload = await getFile(octokit, owner, repoName, "contributions/presentation", ref);

    // let presentationData = presentationPayload.data;

    // for (let i = 1; i < presentationData.length; i++) {
    //     let weekNamePayload = presentationData[i];
    //     let weekName = weekNamePayload.name;
    //     let presentationWeekPayload = await getFile(octokit, owner, repoName, "contributions/presentation/" + weekName, ref);

    //     let presentationGroups = presentationWeekPayload.data;

    //     for (let j = 1; j < presentationGroups.length; j++) {
    //         let groupPayload = presentationGroups[j];
    //         let groupName = groupPayload.name;
    //         let readmePayload = await getReadme(octokit, owner, repoName, "contributions/presentation/" + weekName + "/" + groupName, ref)

    //         let readmeContentBase64 = readmePayload.content;
    //         let readmeContent = atob(readmeContentBase64);
    //         presentationTextArray.push(readmeContent);
    //     }
    // }

    // textArray.push(["presentation", presentationTextArray]);

    // return textArray;
}

/**
 * Using the GitHub API, sends a GET request for a file
 * @param {Object} octokit octokit to handle the GitHub API
 * @param {string} owner owner of the repository
 * @param {string} repoName repository name
 * @param {string} path path of the file
 * @param {string} ref the branch where the file is located
 * @returns {Object} Payload from the request
 */
async function getFile(octokit, owner, repoName, path, ref) {
    return new Promise((resolve, reject) => {
        resolve(
        octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner: owner,
            repo: repoName,
            path: path,
            ref: ref
        })),
        reject("Error")
    })
}

// Inspired from https://github.com/KTH/devops-course/pull/1148/files
// this function fetches a readme in a specific directory on github
var getReadme = async function(octokit, owner, repo, dir, callingBranch='master') {
    return new Promise((resolve,reject) => {octokit.request('GET /repos/{owner}/{repo}/readme/{dir}', {
        owner: owner,
        repo: repo,
        dir: dir,
        ref: callingBranch
    }).then(file =>{ 
        x = atob(file.data.content)
        resolve(file.data)
    }).catch(err => {
      console.log(err)
    }) 
    })
  
}

/**
 * Parses the title
 * @param  {Object} payload Payload containing the title
 * @return {string}         String containing the requester's email
 */
 function parseTitle(payload) {
    const title = payload.issue.title;

    if (title.includes("Teammate request:")) {
        const splitTitle = title.split(":");
        let email = splitTitle[1];
        email = email.slice(1, email.length);
        return email;
    } else {
        return null;
    }
}

/**
 * The main function for finding legal teammates
 */
async function main() {
    try {
        const githubSecret = core.getInput("github-token");
        const listBranch = core.getInput("list-branch");
        const listFile = core.getInput("list-file");
        const mainBranch = core.getInput("main-branch");
        const context = github.context;
        const payload = context.payload;
        const { issue } = github.context;
    
        // Checks if the triggering action is caused by an issue
        if (!payload.issue) {
            core.debug(
              "This event is not an issue being opened"
            );
            return;
        }

        const email = parseTitle(payload);

        if (email != null) {
            console.log("title contains Teammate request:");
            console.log(email);
        } else {
            console.log("wrong title");
            return
        }

        const octokit = github.getOctokit(githubSecret);
        
        // if title contains "Teammate request" then we should do everything
        console.log("title contains Teammate request:");

        console.log("specifying git varables");

        // Variables required to access files in repo
        const owner = issue.owner;
        const repoName = issue.repo;
        const branch = mainBranch;

        // Get student list
        const studentListPayload = await getFile(octokit, owner, repoName, listFile, listBranch);
        
        const studentListBase64 = studentListPayload.data.content;
        const studentListText = atob(studentListBase64);

        // Make a data structure for the students
        let dataStructure = createDataStructure(studentListText);
        console.log(dataStructure);

        // Get all READMEs
        await getAllReadme(octokit, owner, repoName, mainBranch);
        // const files = await getFile(octokit, owner, repoName, "contributions", mainBranch);
        // console.log(files);

        // Example directory
        const dir = "contributions/essay/carinawi-urama"

        console.log("accessing readme");
        // Extract The readme file with the feedback from the correct directory
        var file = await getReadme(octokit,owner,repoName,dir,branch)
        var markdown = atob(file.content) //atob returns a string with the content of the README file

        console.log("Content of the README file:");
        console.log(markdown);

        //var txt = 'carinawi@kth.se justin stefan bob@kth.se john';
        
        const regex = '[a-z]*@kth';
                    
        const matches = [...markdown.matchAll(regex)];

        console.log("emails from the readme-file");
        console.log(matches);

        // TODO finish this
        // Comment about the legal teammates
        await octokit.issues.createComment({
            owner: issue.owner,
            repo: issue.repo,
            issue_number: issue.number,
            body: "PLACEHOLDER"
        });

        // Inspired by https://github.com/marketplace/actions/close-issue
        // Add closing message
        await octokit.issues.createComment({
            owner: issue.owner,
            repo: issue.repo,
            issue_number: issue.number,
            body: "Good luck with your project!\n" +
            "If you would like to search for more potential teammates, " +
            "please create a new issue with the template title:\n" +
            "\"Teammate request: your-kth-email@kth.se\"."
        });

        // Closes the issue
        await octokit.issues.update({
            owner: issue.owner,
            repo: issue.repo,
            issue_number: issue.number,
            state: "closed"
        });

        console.log(`It is working`);
       
    } catch (error) {
        core.setFailed(error.message);
    }   
}

main()