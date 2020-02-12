const fs = require('fs');
const toml = require('toml');
const {Builder, By, Key, until} = require('selenium-webdriver');

async function logIn(driver, credentials) {
    console.log("Logging in...");
    await driver.get('https://www.repl.it/teacher');
    await driver.findElement(By.name('username')).sendKeys(credentials.username);
    await driver.findElement(By.name('password')).sendKeys(credentials.password, Key.RETURN);
    console.log("Login succesful!")
}

async function selectProject(driver) {
    console.log("Opening project...");
    await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'BLA AP CSA')]"))).click();
    await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Published')]"))).click();
    await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Tic Tac Toe')]"))).click();
    console.log("Project open successful!");
}

async function getSubmissions(driver) {
    const submissionsBy = By.css('a[href^="/teacher/submission"]:not([href="/teacher/submissions/undefined"])');
    await driver.wait(until.elementLocated(submissionsBy));
    const submissionElements = await driver.findElements(submissionsBy);

    console.log("Starting to process submissions...");

    // Extract href from all submissions
    const submissionUrls = []
    for (let submissionElement of submissionElements) {
        const submissionHref = await submissionElement.getAttribute('href');
        submissionUrls.push(submissionHref);
    }

    // Process
    const processedSubmissions = [];
    let numSubmissions = 0;	
    for (let submissionUrl of submissionUrls) {
        const processedSubmission = await getSubmission(driver, submissionUrl);
        processedSubmissions.push(processedSubmission);
    }

    return processedSubmissions;	
}

async function getSubmission(driver, href) {
    let retryCounter = 0;

    while (retryCounter < 5) {
        try {
            console.log(`Navigating to student submission at ${href} (retries: ${retryCounter})`);
            driver.get(href)

            console.log("Fetching name...");
            const studentName = await driver.wait(until.elementLocated(By.css('.dynamic-header-center h3'))).getText();
            console.log(`\t Name: ${studentName}`);

            console.log("Attaching to editor...");
            await driver.wait(until.elementLocated(By.css('.ace_editor')));
            const submittedCode = await driver.executeScript(() => ace.edit(document.querySelector('.ace_editor')).getValue());

            console.log("Running tests...");

            // Get the down arrow next to "Run"
            console.log("Click arrow.");
            await driver.wait(until.elementLocated(By.css('div[style="height: 100%; line-height: 26px; width: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-left: inherit;"]'))).click();
            
            // Click "Run tests" in the dropdown
            console.log("Click 'Run tests'");
            await driver.wait(until.elementLocated(By.css('div[style="display: flex; justify-content: center; align-items: center; box-sizing: content-box; height: 29px; width: 100%; font-size: 15px; font-family: Questrial; color: rgb(118, 119, 119); border: 1px solid rgb(237, 237, 237); outline: 0px; background-color: rgb(245, 245, 245); cursor: pointer; margin-left: 0px; line-height: 10px; margin-right: 0px;"]'))).click();
            
            // Wait for tests to finish running
            console.log("Await test completion");
            await driver.wait(until.elementLocated(By.css('div[style="font-size: 20px; color: rgb(63, 64, 63); margin-bottom: 15px;"]')), 60000);

            // Scrape test data
            console.log("Scraping test data");
            const testResultElements = await driver.findElements(By.css('.customScroll > div'));

            // Iterate over test result elements
            const testResults = [];
            for (let testResultElement of testResultElements) {
                const text = await testResultElement.getText();

                // Skip the weird other elements on the page
                if (!text.match("^[a-zA-Z0-9_-]+$")) {
                    continue;
                }

                // Best way to determine pass/fail is from the green background
                const style = await testResultElement.getAttribute('style');
                const testResult = style && style.includes('background: rgb(220, 238, 222);');

                testResults.push(testResult);
            }

            console.log("Information fetched successfully!");
            const studentData = {
                name: studentName,
                code: submittedCode,
                results: testResults,
            }

            return studentData;
        } catch (e) {
            console.error("An error occurred, retrying...");
            console.error(e);
            retryCounter++;
        }
    }
}

function outputSubmissions(submissions) {
    const outputDirectory = './output';

    // Create a clean output directory
    try {
        fs.rmdirSync(outputDirectory, { recursive: true });
    } catch (e) {
        console.log(e);	
    }


    csvLines = []
    fs.mkdirSync(outputDirectory);	

    submissions.forEach(submission => {
        // File name is student name in all caps, separated by underscores, with a .java suffix
        // For example, student "Austin Bourgerie" would output to a file named "AUSTIN_BOURGERIE.java"
        const fileName = submission.name.split(' ').map(name => name.toUpperCase()).join('_') + '.java';

        fs.writeFileSync(`${outputDirectory}/${fileName}`, submission.code);

        const results = submission.results.reduce((string, result) => string + "," + (result ? 1 : 0), "");
        csvLines.push(`${submission.name}${results}`)
    });

    fs.writeFileSync(`${outputDirectory}/results.csv`, csvLines.reduce((line, string) => string + '\n' + line, ""));
}

async function exportSubmissions(credentials) {
    let driver = await new Builder().forBrowser('chrome').build();
    let submissions;

    try {
        await logIn(driver, credentials);
        await selectProject(driver);
        submissions = await getSubmissions(driver);
    } catch (e) {
        console.error(e);
    } finally {
        await driver.quit();
    }

    outputSubmissions(submissions);
};

const credentialsData = fs.readFileSync('credentials.toml');
const credentials = toml.parse(credentialsData);
exportSubmissions(credentials);
