const core = require('@actions/core');
const github = require('@actions/github');
const atob = require('atob');

/**
 * Creates a nested list to represent the students.
 * @param {string} studentListText A string of students
 * @returns {Object} A 3D list of students and values 
 * [[name 1, counter 1, [list of categories]], [name 2, counter 1, [list of categories]]]
 */
function createMainStudentList(studentListText) {
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
 * @param {Object} mainStudentList The student list data structure
 * @returns {string} The comment for the legal teammates
 */
function createTeammateComment(mainStudentList, askingStudentName) {
    const projects = ["course-automation", "demo", "essay", "executable-tutorial", "feedback", "open-source", "presentation"];
    let finalComment = "Legal Teammates:\n";
    let askingStudentCategories = [];

    // find the asking student's categories
    mainStudentList.forEach(studentArray => {
        const studentName = studentArray[0];

        if (studentName.localeCompare(askingStudentName) == 0) {
            askingStudentCategories = studentArray[2];
        }
    });

    // go through the categories
    projects.forEach(category => {
        const text = category + ": "
        finalComment += text;

        // check if asking student has worked 4 project
        // check if asking student has worked in this category
        if (askingStudentCategories < 4 && !askingStudentCategories.includes(category)) {
            // go through the main list of students
            mainStudentList.forEach(studentArray => {
                const studentName = studentArray[0];
                const studentCategories = studentArray[2];
                let partnerBoolean = true;
                let projectAmountBoolean = true;
                let askingStudentBoolean = true;

                // check if this student is the one asking
                if (askingStudentName.localeCompare(studentName) == 0) {
                    askingStudentBoolean = false;
                }

                // check if student has worked in this category
                // check if this student is the one asking
                if (!studentCategories.includes(category) && askingStudentBoolean) {
                    // check if the student has worked with the asking student twice
                    if (studentArray[1] >= 2) {
                        partnerBoolean = false;
                    }
                    // check if the student has worked 4 project
                    else if (studentCategories.length >= 4) {
                        projectAmountBoolean = false;
                    }
        
                    if (partnerBoolean && projectAmountBoolean) {
                        const studentText = studentName + "@kth.se, ";
                        finalComment += studentText;   
                    }
                }
            });
        }

        finalComment += "\n";
    });

    return finalComment;
}

/**
 * Gets all the folder names containing the students' names from the main branch of the repository.
 * @param {Object} octokit octokit to handle the GitHub API
 * @param {string} owner owner of the repository
 * @param {string} repoName repository name
 * @param {string} ref the branch where the file is located
 * @returns {Object} A 3D list of names and which categories they are in. 
 * [[demo, [group 1, group 2]], [presentation, [group 1, group 2]]]
 */
async function getAllFolderNames(octokit, owner, repoName, ref) {
    const projects = ["course-automation", "demo", "essay", "executable-tutorial", "feedback", "open-source"];
    let folderArray = [];

    // go through the project categories
    for (let i = 0; i < projects.length; i++) {
        let categoryPayload = await getFile(octokit, owner, repoName, "contributions/" + projects[i], ref);
        let categoryGroups = categoryPayload.data;
        let categoryArray = [];

        // go through the projects in this category
        for (let j = 1; j < categoryGroups.length; j++) {
            let groupPayload = categoryGroups[j];
            let groupName = groupPayload.name;
            categoryArray.push(groupName);
        }
        
        folderArray.push([projects[i], categoryArray]);
    }

    // special section for presentation because they have "weeks" subfolder

    let presentationFolderArray = [];
    let presentationPayload = await getFile(octokit, owner, repoName, "contributions/presentation", ref);

    let presentationData = presentationPayload.data;

    // go through the weeks
    for (let i = 1; i < presentationData.length; i++) {
        let weekNamePayload = presentationData[i];
        let weekName = weekNamePayload.name;
        let presentationWeekPayload = await getFile(octokit, owner, repoName, "contributions/presentation/" + weekName, ref);

        let presentationGroups = presentationWeekPayload.data;

        // go through the presentation this week
        for (let j = 1; j < presentationGroups.length; j++) {
            let groupPayload = presentationGroups[j];
            let groupName = groupPayload.name;
            
            presentationFolderArray.push(groupName);
        }
    }

    folderArray.push(["presentation", presentationFolderArray]);

    return folderArray;
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
 * Parses the title.
 * @param  {Object} payload Payload containing the title
 * @return {string}         String containing the requester's email name
 */
 function parseTitle(payload) {
    const title = payload.issue.title;

    if (title.includes("Teammate request:")) {
        const splitTitle = title.split(":");
        let email = splitTitle[1];
        email = email.slice(1, email.length);
        let nameList = email.split("@");
        return nameList[0];
    } else {
        return null;
    }
}

/**
 * Updates the main student list with the data from the folders.
 * @param {Object} mainStudentList the main list of students
 * @param {Object} folderNames the list of folder names
 * @param {string} askingStudentName the name of the asking student
 * @returns {Object} The updated main student list
 */
 function updateMainStudentList(mainStudentList, folderNames, askingStudentName) {
    // go through the categories
    folderNames.forEach(categoryArray => {
        let categoryName = categoryArray[0];

        // split the group names
        categoryArray[1].forEach(groups => {
            let groupNames = groups.split("-");

            // go through the group names
            groupNames.forEach(name => {
                // if the asking student is in the group
                if (groupNames.includes(askingStudentName)) {
                    for (let index = 0; index < mainStudentList.length; index++) {
                        let dataStudent = mainStudentList[index];
                        let studentCategories = dataStudent[2];
                        const studentName = dataStudent[0];
    
                        // if it is the asking student's partner in this project
                        if (studentName.includes(name)) {
                            studentCategories.push(categoryName);
                            dataStudent[1] += 1;   
                        }
                    }
                } else {
                    for (let index = 0; index < mainStudentList.length; index++) {
                        let dataStudent = mainStudentList[index];
                        let studentCategories = dataStudent[2];
                        const studentName = dataStudent[0];
    
                        if (studentName.localeCompare(name) == 0) {
                            studentCategories.push(categoryName);
                        }
                    }
                }
            });
        });
    });

    return mainStudentList;
}

/**
 * The main function for finding legal teammates.
 */
async function main() {
    try {
        const githubSecret = core.getInput("github-token");
        const studentListBranch = core.getInput("list-branch");
        const studentListFile = core.getInput("list-file");
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

        const askingStudentName = parseTitle(payload);

        // if title contains "Teammate request" then we should do everything
        if (askingStudentName != null) {
            console.log("title contains Teammate request:");
            console.log(askingStudentName);
        } else {
            console.log("Wrong title or issue not asking for legal teammates");
            return
        }

        const octokit = github.getOctokit(githubSecret);

        // Variables required to access files in repo
        const owner = issue.owner;
        const repoName = issue.repo;

        // Get student list
        const studentListPayload = await getFile(octokit, owner, repoName, studentListFile, studentListBranch);
        
        const studentListBase64 = studentListPayload.data.content;
        const studentListText = atob(studentListBase64);

        // Make a data structure for the students
        let mainStudentList = createMainStudentList(studentListText);

        // Get all folder names
        let folderNames = await getAllFolderNames(octokit, owner, repoName, mainBranch);
        console.log(folderNames);

        // Update the main student list with the file names data
        let updatedMainStudentList = updateMainStudentList(mainStudentList, folderNames, askingStudentName);

        const teammateComment = createTeammateComment(updatedMainStudentList, askingStudentName);

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

        console.log("Done");
       
    } catch (error) {
        core.setFailed(error.message);
    }   
}

main()