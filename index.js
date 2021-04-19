const core = require('@actions/core');
const github = require('@actions/github');
var atob = require('atob');
const { Context } = require('@actions/github/lib/context');

/**
 * Parses the title
 * @param  {Object} payload Payload containing the title
 * @return {String}         String containing the requester's email
 */
function parseTitle(payload) {
    const title = payload.issue.title;

    if (title.includes("Teammate request:")) {
        return "a";
    } else {
        return "";
    }
}

/**
 * The main function for finding legal teammates
 */
async function main() {
    try {
        const githubSecret = core.getInput("github-token");
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

        const parsedTitle = parseTitle(payload);

        const octokit = github.getOctokit(githubSecret);

        

        
        if (parsedTitle != "") {
            // if title contains "Teammate request" then we should do everything
            console.log("title contains Teammate request:");

            console.log("specifying git varables");

            // Variables required to access files in repo
            const owner = github.context.payload.repository.owner.login
            const repoName = "devops-course"
            const branch = "2021"

            // Example directory
            const dir = "contributions/essay/carinawi-urama"

            // Extract The readme file with the feedback from the correct directory

            // get all folders
            await octokit.request('GET /repos/{owner}/{repoName}/{dirs}', {
                dirs: 'dirs'
            })

            console.log("getting all dirs");
            console.log(dirs);
            

            console.log("accessing readme");
            var file = await getReadme(octokit,owner,repoName,dir,branch)
            var markdown = atob(file.content) //atob returns a string with the content of the README file

            console.log("Content of the README file:");
            console.log(markdown);

            //var txt = 'carinawi@kth.se justin stefan bob@kth.se john';
            
            const regex = '[a-z]*@kth';
                        
            const matches = [...markdown.matchAll(regex)];

            console.log("emails from the readme-file");
            console.log(matches);


            // Add closing message
            await octokit.issues.createComment({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
                body: "Here is a list of legal teammates for you!\n" +
                "email, email, email ... "
            });

            // Closes the issue
            await octokit.issues.update({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
                state: "closed"
            });


        } else {
            console.log("wrong title");

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

        }


       
    } catch (error) {
        core.setFailed(error.message);
    }   
}

// stolen (then modified) from https://github.com/KTH/devops-course/pull/1148/files
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


main()