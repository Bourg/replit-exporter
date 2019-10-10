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
	await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Hourglass')]"))).click();
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
	console.log(`Navigating to student submission at ${href}`);
	driver.get(href)

	console.log("Fetching name...");
	const studentName = await driver.wait(until.elementLocated(By.css('.dynamic-header-center h3'))).getText();

	console.log("Attaching to editor...");
	await driver.wait(until.elementLocated(By.css('.ace_editor')));
	const submittedCode = await driver.executeScript(() => ace.edit(document.querySelector('.ace_editor')).getValue());

	console.log("Information fetched successfully!");
	return {
		name: studentName,
		code: submittedCode,
	}
	console.log(studentName);
	console.log(submittedCode);
}

function outputSubmissions(submissions) {
	const outputDirectory = './output';

	// Create a clean output directory
	try {
		fs.rmdirSync(outputDirectory, { recursive: true });
	} catch (e) {
		console.log(e);	
	}

	fs.mkdirSync(outputDirectory);	

	submissions.forEach(submission => {
		// File name is student name in all caps, separated by underscores, with a .java suffix
		// For example, student "Austin Bourgerie" would output to a file named "AUSTIN_BOURGERIE.java"
		const fileName = submission.name.split(' ').map(name => name.toUpperCase()).join('_') + '.java';

		fs.writeFileSync(`${outputDirectory}/${fileName}`, submission.code);
	});
}

async function exportSubmissions(credentials) {
	let driver = await new Builder().forBrowser('chrome').build();
	let submissions;

	try {
		await logIn(driver, credentials);
		await selectProject(driver);
		submissions = await getSubmissions(driver);
	} finally {
		await driver.quit();
	}

	outputSubmissions(submissions);
};

const credentialsData = fs.readFileSync('credentials.toml');
const credentials = toml.parse(credentialsData);
exportSubmissions(credentials);
