const core = require('@actions/core');
const github = require('@actions/github');
var atob = require('atob');
const { Context } = require('@actions/github/lib/context');

/**
 * Creates a nested list to represent the students.
 * @param {string} studentListText A string of students
 * @returns {Object} A 3D list of students and values 
 * [[name 1, counter 1, [list of categories]], [name 2, counter 1, [list of categories]]]
 */
function createDataStructure(studentListText) {
    let names = studentListText.split("\n");
    names.pop();
    names.sort();
    let dataStructure = [];

    names.forEach(name => {
        let data = [name, 0, []];
        dataStructure.push(data)
    });

    return dataStructure
}

/**
 * Creates a text for the legal teammates comment.
 * @param {Object} dataStructure The student list data structure
 * @returns {string} The comment for the legal teammates
 */
function createTeammateComment(dataStructure) {
    const projects = ["course-automation", "demo", "essay", "executable-tutorial", "feedback", "open-source", "presentation"];
    let finalComment = "Legal Teammates:\n";

    projects.forEach(category => {
        const text = category + ": "
        finalComment += text;

        dataStructure.forEach(studentArray => {
            const studentName = studentArray[0];
            const studentCategories = studentArray[2];
            let studentCategoryBoolean = true;

            for (let i = 0; i < studentCategories.length; i++) {
                if (studentCategories[i].localeCompare(category) == 0) {
                    studentCategoryBoolean = false;
                }
            }

            if (studentCategoryBoolean && (studentArray[1] < 4)) {
                const studentText = studentName + "@kth.se, ";
                finalComment += studentText;
            }
        });

        finalComment += "\n";
    });

    return finalComment;
}

function updateStudents(legalStudentList, fileNames) {
    fileNames.forEach(categoryArray => {
        let categoryName = categoryArray[0];

        categoryArray[1].forEach(groups => {
            let groupNames = groups.split("-");

            groupNames.forEach(name => {
                
                for (let index = 0; index < legalStudentList.length; index++) {
                    let dataStudent = legalStudentList[index];
                    let studentCategories = dataStudent[2];
                    const studentName = dataStudent[0];

                    if (studentName.localeCompare(name) == 0) {
                        studentCategories.push(categoryName);
                        dataStudent[1] += 1;
                    }
                }
            });
        });
    });

    console.log(legalStudentList);

    return legalStudentList;
}

/**
 * Gets all the READMEs from the main branch of the repository. Requires the name of the README to be README not a typo like REAMDE.
 * @param {Object} octokit octokit to handle the GitHub API
 * @param {string} owner owner of the repository
 * @param {string} repoName repository name
 * @param {string} ref the branch where the file is located
 * @returns {Object} A 3D list of READMEs and which categories they are in. 
 * [[demo, [group 1, group 2]], [presentation, [group 1, group 2]]]
 */
async function getAllFileNames(octokit, owner, repoName, ref) {
    const projects = ["course-automation", "demo", "essay", "executable-tutorial", "feedback", "open-source"];
    let textArray = [];

    for (let i = 0; i < projects.length; i++) {
        let categoryPayload = await getFile(octokit, owner, repoName, "contributions/" + projects[i], ref);
        let categoryGroups = categoryPayload.data;
        let categoryArray = [];

        for (let j = 1; j < categoryGroups.length; j++) {
            let groupPayload = categoryGroups[j];
            let groupName = groupPayload.name;
            categoryArray.push(groupName);
        }
        
        textArray.push([projects[i], categoryArray]);
    }

    let presentationTextArray = [];
    let presentationPayload = await getFile(octokit, owner, repoName, "contributions/presentation", ref);

    let presentationData = presentationPayload.data;

    for (let i = 1; i < presentationData.length; i++) {
        let weekNamePayload = presentationData[i];
        let weekName = weekNamePayload.name;
        let presentationWeekPayload = await getFile(octokit, owner, repoName, "contributions/presentation/" + weekName, ref);

        let presentationGroups = presentationWeekPayload.data;

        for (let j = 1; j < presentationGroups.length; j++) {
            let groupPayload = presentationGroups[j];
            let groupName = groupPayload.name;
            
            presentationTextArray.push(groupName);
        }
    }

    textArray.push(["presentation", presentationTextArray]);

    return textArray;
}

/**
 * Using the GitHub API, sends a GET request for a file.
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
 * The main function for finding legal teammates.
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

        // Get all file names
        let filenames = await getAllFileNames(octokit, owner, repoName, mainBranch);
        //console.log(readmes);

        let updatedLegalStudentList = updateStudents(dataStructure, filenames);

        const teammateComment = createTeammateComment(updatedLegalStudentList);
        console.log(teammateComment);

        // TODO finish this
        // Comment about the legal teammates
        await octokit.issues.createComment({
            owner: issue.owner,
            repo: issue.repo,
            issue_number: issue.number,
            body: teammateComment
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