/*************************************************************************
 (c) Copyright [2016] Hewlett Packard Enterprise Development LP

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*************************************************************************/

/*
 This sample demonstrates how to run transactions as part of an NV test.

 In this sample, the NV test starts with the "3G Busy" network scenario, running three transactions (see below).
 After the sample stops and analyzes the NV test, it prints the analysis .zip file path to the console.

 This sample runs three NV transactions:
 1. "Home Page" transaction: Navigates to the home page in the HPE Network Virtualization website
 2. "Get Started" transaction: Navigates to the Get Started Now page in the HPE Network Virtualization website
 3. "Overview" transaction: Navigates back to the home page in the HPE Network Virtualization website

 basic_analyze_nv_transactions.js steps:
 1. Create a TestManager object and initialize it.
 2. Start the NV test with the "3G Busy" network scenario.
 3. Connect the NV test to the transaction manager.
 4. Start the "Home Page" NV transaction.
 5. Build the Selenium WebDriver.
 6. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 7. Stop the "Home Page" NV transaction.
 8. Start the "Get Started" NV transaction.
 9. Click the "Get Started Now" button using the Selenium WebDriver.
 10. Stop the "Get Started" NV transaction.
 11. Start the "Overview" NV transaction.
 12. Click the "Overview" button using the Selenium WebDriver.
 13. Stop the "Overview" NV transaction.
 14. Close and quit the Selenium WebDriver.
 15. Stop and analyze the NV test and get the result as a .zip file.
 16. Print the path of the .zip file to the console.
 */
var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    proxy = require('selenium-webdriver/proxy'),
    NV = require('hpe-nv-js-api'),
    TestManager = NV.TestManager,
    Test = NV.Test,
    Flow = NV.Flow,
    Transaction = NV.Transaction,
    Spinner = require('cli-spinner').Spinner;

var program = require('commander');

// program arguments
program
    .usage('[options]')
    .option('-i, --server-ip <serverIp>', '[mandatory] NV Test Manager IP')
    .option('-o, --server-port <serverPort>', '[mandatory] NV Test Manager port')
    .option('-u, --username <username>', '[mandatory] NV username')
    .option('-w, --password <password>', '[mandatory] NV password')
    .option('-e, --ssl <ssl>', '[optional] Pass true to use SSL. Default: false')
    .option('-y, --proxy <proxy>', '[optional] Proxy server host:port')
    .option('-z, --zip-result-file-path <zipResultFilePath>', '[optional] File path to store the analysis results as a .zip file')
    .option('-k, --analysis-ports <analysisPorts>', '[optional] A comma-separated list of ports for test analysis', function(ports) {
        var portsArrStrings = ports.replace(" ", "").split(",");
        var portsArr = [];
        for (var i = 0; i < portsArrStrings.length; i++) {
            portsArr[i] = parseInt(portsArrStrings[i]);
            if (isNaN(portsArr[i])) {
                throw new Error('Analysis ports argument must be a comma-separated list of integers without white spaces');
            }
        }
        return portsArr;
    })
    .option('-b, --browser <browser>', '[optional] The browser for which the Selenium WebDriver is built. Possible values: Chrome and Firefox. Default: Firefox')
    .option('-d, --debug <debug>', '[optional] Pass true to view console debug messages during execution. Default: false')
    .parse(process.argv);

// validate program arguments
if (!program.serverIp) {
    throw new Error('Missing argument: -i/--server-ip <serverIp>');
}

if (!program.serverPort) {
    throw new Error('Missing argument: -o/--server-port <serverPort>');
}

if (!program.username) {
    throw new Error('Missing argument: -u/--username <username>');
}

if (!program.password) {
    throw new Error('Missing argument: -w/--password <password>');
}

if (program.serverIp && program.serverIp === "0.0.0.0") {
    throw new Error('Please replace the server IP argument value (0.0.0.0) with your NV Test Manager IP');
}

// program body
(function(program) {
    var testManager, siteTest, site1Transaction, site2Transaction, site3Transaction;
    var driver;
    var testRunning = false, transactionInProgress = false;
    var transactionInProgressIndex = -1;

    // get program arguments
    var zipResultFilePath = program.zipResultFilePath;
    var useSSL = (program.ssl && program.ssl.toLowerCase() === 'true') ? true: false;
    var serverIp = program.serverIp;
    var serverPort = program.serverPort;
    var username = program.username;
    var password = program.password;
    var proxySetting = program.proxy;
    var analysisPorts = program.analysisPorts || [8080, 80];
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***   This sample demonstrates how to run transactions as part of an NV test.                                               ***\n" +
                          "***                                                                                                                         ***\n" +
                          "***   In this sample, the NV test starts with the \"3G Busy\" network scenario, running three transactions (see below).       ***\n" +
                          "***   After the sample stops and analyzes the NV test, it prints the analysis .zip file path to the console.                ***\n" +
                          "***                                                                                                                         ***\n" +
                          "***   This sample runs three NV transactions:                                                                               ***\n" +
                          "***   1. \"Home Page\" transaction: Navigates to the home page in the HPE Network Virtualization website                      ***\n" +
                          "***   2. \"Get Started\" transaction: Navigates to the Get Started Now page in the HPE Network Virtualization website         ***\n" +
                          "***   3. \"Overview\" transaction: Navigates back to the home page in the HPE Network Virtualization website                  ***\n" +
                          "***                                                                                                                         ***\n" +
                          "***   You can view the actual steps of this sample in the basic_analyze_nv_transactions.js file.                            ***\n";

    // init console spinner
    var spinner = new Spinner("");
    spinner.setSpinnerString("|/-\\");

    // log debug messages
    function logDebugMessage(message) {
        if (debug) {
            console.log(message);
        }
    }

    // handle errors and stop currently running tests and transactions
    function handleError(errorMessage) {
        //stop spinner
        if (!debug) {
            spinner.stop(true);
        }

        console.error("Error occurred: " + errorMessage);
        if (driver) {
            driver.close();
            driver.quit();
            driver = null;
        }

        if (testRunning) {
            try {
                stopTest().
                    then(function () {
                        return setTestRunning(false);
                    }).
                    then(null,
                    function(error) {
                        console.error("Stop test failed with error: " + error);
                    });
            } catch(error) {
                console.error("Stop test failed with error: " + error);
            }
        }

        // stop spinner
        if (!debug) {
            spinner.stop(true);
        }
    }

    // print done message to console and stop console spinner
    function doneCallback() {
        var promise = new Promise(function(resolve, reject) {
            //stop spinner
            if (!debug) {
                spinner.stop(true);
            }

            console.log("Sample execution ended successfully");
            resolve();
        });
        return promise;
    }

    // close and quit the Selenium WebDriver
    function driverCloseAndQuit() {
        var promise = new Promise(function(resolve, reject) {
            logDebugMessage("Closing and quitting the Selenium WebDriver");
            driver.close();
            driver.quit();
            driver = null;
            resolve();
        });
        return promise;
    }

    // Create and initialize the TestManager object
    function initTestManager() {
        // create a TestManager object
        logDebugMessage("Creating and initializing the TestManager object");
        var testManagerConfig = {
            serverIP: serverIp,
            serverPort: serverPort,
            username: username,
            password: password,
            useSSL: useSSL
        };
        testManager = new TestManager(testManagerConfig);
        // call the init method
        return testManager.init();
    }

    // start an NV test with the "3G Busy" network scenario
    function startTest() {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "basic_analyze_nv_transactions Sample Test",
            networkScenario: "3G Busy",
            testMode: Test.MODE.CUSTOM
        };
        siteTest = new Test(testConfig);

        // add a flow to the test
        logDebugMessage("Adding a flow to the NV test");
        var flowConfig = {
            flowId: "Flow1",
            latency: 200,
            packetloss: 0.5,
            bandwidthIn: 384,
            bandwidthOut: 128
        };
        var flow = new Flow(flowConfig);
        siteTest.addFlow(flow);

        // start the test
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Starting the NV test with the \"3G Busy\" network scenario");
        if (!debug) {
            spinner.start();
        }
        return siteTest.start();
    }

    // connect the NV test to the transaction manager
	function connectToTransactionManager() {
        logDebugMessage("Connecting the NV test to the transaction manager");
		return siteTest.connectToTransactionManager();
	}

    // start an NV transaction according to parameter i:
    // i = 1: start the "Home Page" transaction
    // i = 2: start the "Get Started" transaction
    // i = 3: start the "Overview" transaction
    function startTransaction(i) {

		var transactionName = (i === 1 ? "Home Page" : (i === 2 ? "Get Started": "Overview"));
        // create an NV transaction
        logDebugMessage("Creating the \"" + transactionName + "\" transaction");

        var pageTransactionConfig = {};
        pageTransactionConfig.name = transactionName;
        var pageTransaction = new Transaction(pageTransactionConfig);

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"" + transactionName+ "\" transaction to the NV test");

        return pageTransaction.addToTest(siteTest).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"" + transactionName + "\" transaction");
                if (!debug) {
                    spinner.start();
                }
                return pageTransaction.start();
            }).
			then(function() {
				return new Promise(function(resolve, reject) {
					if (i === 1) {
						site1Transaction = pageTransaction;
					}
					else if (i === 2) {
						site2Transaction = pageTransaction;
					}
					else {
						site3Transaction = pageTransaction;
					}
                    transactionInProgressIndex = i;
					resolve();
				});
			});
    }

    // build the Selenium WebDriver
    function buildSeleniumWebDriver() {
        logDebugMessage('Building the Selenium WebDriver for ' + browser);
        var promise = new Promise(function(resolve, reject) {

            // init Chrome capabilities
            var chromeCapabilities = webdriver.Capabilities.chrome();
            var chromeOptions = {
                'args': ['--test-type', '--start-maximized', '--disable-logging', '--log-level=3', '--disable-flash-sandbox', '--disable-gpu-sandbox', '--enable-sandbox-logging=false']//, '--no-sandbox'
            };
            chromeCapabilities.set('chromeOptions', chromeOptions);

            if (proxySetting) {
                if (browser.toLowerCase() === 'firefox') {
                    driver = new webdriver.Builder()
                        .forBrowser('firefox')
                        .setProxy(proxy.manual({http: proxySetting}))
                        .build();
                }
                else {
                    driver = new webdriver.Builder()
                        .forBrowser('chrome')
                        .withCapabilities(chromeCapabilities)
                        .setProxy(proxy.manual({http: proxySetting}))
                        .build();
                }
            }
            else {
                if (browser.toLowerCase() === 'firefox') {
                    driver = new webdriver.Builder()
                        .forBrowser('firefox')
                        .build();
                }
                else {
                    driver = new webdriver.Builder()
                        .forBrowser('chrome')
                        .withCapabilities(chromeCapabilities)
                        .build();
                }
            }
        });		
		 
        return driver.sleep(1000);
    }

    // navigate to the specified site and wait for the specified element to display
    function seleniumNavigateToPage() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Navigating to the NV site using the Selenium WebDriver");
        if (!debug) {
            spinner.start();
        }
        // navigate to the site
		driver.get('http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html');
        driver.manage().timeouts().pageLoadTimeout(2000000);

        // wait for the element to display
		return driver.wait(function () {
            return driver.isElementPresent(By.xpath("//nav//span[contains(text(), 'Get Started')]"));
        }, 1000*60*2);		
    }

    // navigate to the "Get Started Now" page using the Selenium WebDriver
	function seleniumGetStartedClick() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Navigating to the \"Get Started Now\" page using the Selenium WebDriver");
        if (!debug) {
            spinner.start();
        }
		driver.findElement(By.xpath("//nav//span[contains(text(), 'Get Started')]")).click();

        // wait for the element to display
		return driver.wait(function () {
            return driver.isElementPresent(By.xpath("//*[contains(text(), 'Network Virtualization Downloads')]"));
        }, 1000*60*2);		
    }

    // navigate to the "Overview" page using the Selenium WebDriver
	function seleniumOverviewClick() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Navigating to the \"Overview\" page using the Selenium WebDriver");
        if (!debug) {
            spinner.start();
        }
        driver.findElement(By.xpath("//nav//span[contains(text(), 'Overview')]")).click();

        // wait for the element to display
		return driver.wait(function () {
            return driver.isElementPresent(By.xpath("//*[contains(text(), 'Key Capabilities')]"));
        }, 1000*60*2);		
    }

    // stop an NV transaction according to parameter i:
    // i = 1: stop the "Home Page" transaction
    // i = 2: stop the "Get Started" transaction
    // i = 3: stop the "Overview" transaction
    function stopTransaction(i) {
        var transaction = (i == 1 ? site1Transaction: (i == 2 ? site2Transaction: site3Transaction));

        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the \"" + transaction.name  + "\" transaction");
        if (!debug) {
            spinner.start();
        }
        return transaction.stop();
    }

    // stop the NV test
    function stopTest() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the NV test");
        if (!debug) {
            spinner.start();
        }
        return siteTest.stop();
    }

    // stop and analyze the NV test and get the result as a .zip file
    function stopTestAndAnalyze() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping and analyzing the NV test and getting the result as a .zip file");
        if (!debug) {
            spinner.start();
        }
        var analyzeParams = {
            ports: analysisPorts
        };
        if (zipResultFilePath) {
            analyzeParams.zipResultFilePath = zipResultFilePath;
        }
        return siteTest.stopAndAnalyze(analyzeParams).then(printZipLocation);
    }

    // print the path of the .zip file, if the --zip-result-file-path argument is specified
    function printZipLocation(zipLocation) {
        var promise = new Promise(function(resolve, reject) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log("Analysis result .zip file path: " + zipLocation);
            if (!debug) {
                spinner.start();
            }
            resolve();
        });

        return promise;
    }

    // set the testRunning Boolean and return a promise object
    function setTestRunning(isTestRunning) {
        return new Promise(function(resolve, reject) {
            testRunning = isTestRunning;
            resolve();
        });
    }

    // set the transactionInProgress Boolean and return a promise object
    function setTransactionInProgress(isTransactionInProgress) {
        return new Promise(function(resolve, reject) {
            transactionInProgress = isTransactionInProgress;
            resolve();
        });
    }

    // print a description of the next part of the sample
    function printPartDescription(description) {
        return new Promise(function(resolve, reject) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log(description);
            if (!debug) {
                spinner.start();
            }
            resolve();
        });
    }

    // print a newline to separate between parts
    function printPartSeparator() {
        return new Promise(function(resolve, reject) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log();
            if (!debug) {
                spinner.start();
            }
            resolve();
        });
    }

    // print the sample's description
    console.log(testDescription);

    // start console spinner
    if (!debug) {
        spinner.start();
    }

    // sample execution steps
    try {
        /*****    Part 1 - Start the NV test with the "3G Busy" network scenario                                                                      *****/
        printPartDescription("------    Part 1 - Start the NV test with the \"3G Busy\" network scenario").
        then(initTestManager).
        then(startTest).
        then(function() {return setTestRunning(true);}).
        then(printPartSeparator).
        /*****    Part 2 - Run three transactions - "Home Page", "Get Started" and "Overview"                                                         *****/
        then(function() {return printPartDescription("------    Part 2 - Run three transactions - \"Home Page\", \"Get Started\" and \"Overview\"");}).
        then(connectToTransactionManager).
        then(function() {return startTransaction(1);}).
        then(function() {return setTransactionInProgress(true);}).
        then(buildSeleniumWebDriver).
        then(function() {return seleniumNavigateToPage();}).
        then(function() {return stopTransaction(1);}).
        then(function() {return setTransactionInProgress(false);}).
        then(function() {return startTransaction(2);}).
        then(function() {return setTransactionInProgress(true);}).
        then(function() {return seleniumGetStartedClick();}).
        then(function() {return stopTransaction(2);}).
        then(function() {return setTransactionInProgress(false);}).
        then(function() {return startTransaction(3);}).
        then(function() {return setTransactionInProgress(true);}).
        then(function() {return seleniumOverviewClick();}).
        then(function() {return stopTransaction(3);}).
        then(function() {return setTransactionInProgress(false);}).
        then(driverCloseAndQuit).
        then(printPartSeparator).
        /*****    Part 3 - Stop the NV test, analyze it and print the results to the console                                                          *****/
        then(function() {return printPartDescription("------    Part 5 - Stop the NV test, analyze it and print the results to the console");}).
        then(stopTestAndAnalyze).
        then(function() {return setTestRunning(false);}).
        then(printPartSeparator).
        then(doneCallback).
        then(null, handleError);
    } catch(err) {
        if (!debug) {
            spinner.stop(true);
        }
        handleError(err);
    }
})(program);
