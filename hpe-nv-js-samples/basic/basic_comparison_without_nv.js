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
 This sample demonstrates how NV helps you test your application under various network conditions.

 This test starts by navigating to the home page in the HPE Network Virtualization website using the Selenium WebDriver.
 This initial step runs without NV emulation and provides a basis for comparison.

 Next, the sample starts an NV test configured with a "3G Busy" network scenario.
 The same step runs as before - navigating to the home page in the HPE Network Virtualization website - but this time,
 it does so over an emulated "3G Busy" network as part of an NV transaction.

 When the sample finishes running, it prints a summary to the console. This summary displays a comparison of the time
 it took to navigate to the site both with and without NV's network emulation. The results show that the slow "3G Busy"
 network increases the time it takes to navigate to the site, as you would expect.

 basic_comparison_without_nv.js steps:
 1. Build the Selenium WebDriver.
 2. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 3. Close and quit the Selenium WebDriver.
 4. Create and initialize the TestManager object.
 5. Set the active adapter.
 6. Start the NV test with the "3G Busy" network scenario.
 7. Connect to the transaction manager.
 8. Start the "Home Page" NV transaction.
 9. Rebuild the Selenium WebDriver.
 10. Navigate to the site again.
 11. Stop the "Home Page" NV transaction.
 12. Close and quit the Selenium WebDriver.
 13. Stop the NV test.
 14. Analyze the NV test and extract the network time for the NV transaction.
 15. Print the network time comparison summary to the console.
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
    .option('-a, --active-adapter-ip <activeAdapterIp>', '[optional] Active adapter IP. Default: --server-ip argument')
    .option('-t, --site-url <siteUrl>', '[optional] Site under test URL. Default: HPE Network Virtualization site URL. If you change this value, make sure to change the --xpath argument too')
    .option('-x, --xpath <xpath>', "[optional] Parameter for driver.isElementPresent(By.xpath(...)) method. Use an xpath expression of some element in the site. Default: //div[@id='content']")
    .option('-k, --analysis-ports <analysisPorts>', '[optional] A comma-separated list of ports for test analysis', function(ports) {
        var portsArrStrings = ports.replace(" ", "").split(",");
        var portsArr = [];
        for (var i = 0; i < portsArrStrings.length; i++) {
            portsArr[i] = parseInt(portsArrStrings[i]);
            if (isNaN(portsArr[i])) {
                throw new Error('--analysis-ports argument must be a comma-separated list of integers without white spaces');
            }
        }
        return portsArr;
    })
    .option('-b, --browser <browser>', '[optional] The browser for which the Selenium WebDriver is built. Possible values: Chrome, Firefox. Default: Firefox')
    .option('-d, --debug <debug>', '[optional] Pass true to view console debug messages during execution. Default: false')
    .parse(process.argv);

// validate program arguments
if (!program.serverIp) {
    throw new Error("Missing argument: -i/--server-ip <serverIp>");
}

if (!program.serverPort) {
    throw new Error("Missing argument: -o/--server-port <serverPort>");
}

if (!program.username) {
    throw new Error("Missing argument: -u/--username <username>");
}

if (!program.password) {
    throw new Error("Missing argument: -w/--password <password>");
}

if (program.serverIp && program.serverIp === "0.0.0.0") {
    throw new Error('Please replace the server IP argument value (0.0.0.0) with your NV Test Manager IP');
}

// program body
(function(program) {
    var testManager, siteTest, pageTransaction, startNoNV, stopNoNV;
    var driver;
    var testRunning = false, transactionInProgress = false;

    // get program arguments
    var useSSL = (program.ssl && program.ssl.toLowerCase() === 'true') ? true: false;
    var serverIp = program.serverIp;
    var serverPort = program.serverPort;
    var username = program.username;
    var password = program.password;
    var proxySetting = program.proxy;
    var siteUrl = program.siteUrl || 'http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html';
    var xpath = program.xpath || "//div[@id='content']";
    var activeAdapterIp = program.activeAdapterIp || program.serverIp;
    var analysisPorts = program.analysisPorts || [8080, 80];
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***    This sample demonstrates how NV helps you test your application under various network conditions.                          ***\n" +
                          "***    This test starts by navigating to the home page in the HPE Network Virtualization website using the Selenium WebDriver.    ***\n" +
                          "***    This initial step runs without NV emulation and provides a basis for comparison.                                           ***\n" +
                          "***                                                                                                                               ***\n" +
                          "***    Next, the sample starts an NV test configured with a \"3G Busy\" network scenario.                                           ***\n" +
                          "***    The same step runs as before - navigating to the home page in the HPE Network Virtualization website - but this time,      ***\n" +
                          "***    it does so over an emulated \"3G Busy\" network as part of an NV transaction.                                                ***\n" +
                          "***                                                                                                                               ***\n" +
                          "***    When the sample finishes running, it prints a summary to the console. This summary displays a comparison of the time       ***\n" +
                          "***    it took to navigate to the site both with and without NV's network emulation. The results show that the slow \"3G Busy\"     ***\n" +
                          "***    network increases the time it takes to navigate to the site, as you would expect.                                          ***\n" +
                          "***                                                                                                                               ***\n" +
                          "***    You can view the actual steps of this sample in the basic_comparison_without_nv.js file.                                   ***\n";

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
        // stop spinner
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
            // stop spinner
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

    // set the active adapter (the active adapter determines the NIC through which impairments are applied to the traffic and packets are captured)
    function setActiveAdapter() {
        logDebugMessage("Setting the active adapter");
        var activeAdapterConfig = {ip: activeAdapterIp};
        return testManager.setActiveAdapter(activeAdapterConfig);
    }

    // start an NV test with the "3G Busy" network scenario
    function startBusyTest() {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "basic_comparison_without_nv Sample Test",
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
        console.log("Starting the NV test");
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

    // start the "Home Page" NV transaction
    function startTransaction() {
        // create an NV transaction
        logDebugMessage("Creating the \"Home Page\" transaction");
        var pageTransactionConfig = {};
        pageTransactionConfig.name = "Home Page";
        pageTransaction = new Transaction(pageTransactionConfig);

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"Home Page\" transaction to the NV test");
        return pageTransaction.addToTest(siteTest).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"Home Page\" transaction");
                if (!debug) {
                    spinner.start();
                }
                return pageTransaction.start();
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
        console.log("Navigating to the specified site using the Selenium WebDriver");
        if (!debug) {
            spinner.start();
        }
		// navigate to the site
        driver.get(siteUrl);
        driver.manage().timeouts().pageLoadTimeout(2000000);

        // wait for the specified element to display
		return driver.wait(function () {
            return driver.isElementPresent(By.xpath(xpath));
        }, 1000*60*2);		
    }

    // stop the "Home Page" NV transaction
    function stopTransaction() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the \"Home Page\" transaction");
        if (!debug) {
            spinner.start();
        }
        return pageTransaction.stop();
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

    // analyze the NV test and retrieve the result as an object
    function analyzeTestJson() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Analyzing the NV test and getting the result as an object");
        if (!debug) {
            spinner.start();
        }
        var analyzeParams = {
            ports: analysisPorts,
            useJsonFormat: true
        };
        return siteTest.analyze(analyzeParams).then(printTimes);
    }

    // print the site navigation time summary
    function printTimes(analysisResultJsonString) {
        var promise = new Promise(function(resolve, reject) {
            var analysisResultJson = JSON.parse(analysisResultJsonString);
            // stop spinner
            if (!debug) {
                spinner.stop(true);
            }

            console.log("\n");
            console.log("Site navigation time in seconds:");

            var timeWithoutNV = (stopNoNV - startNoNV)/1000;
            var timeWithNV = analysisResultJson.transactionSummaries[0].properties.networkTime/1000;

            console.log("--- Time to navigate to the site without NV emulation: " + timeWithoutNV + "s");
            console.log("--- Time to navigate to the site with the NV \"3G Busy\" network scenario: " + timeWithNV + "s");
            console.log("--------- (Running this transaction with network emulation increased the time by: " + (timeWithNV - timeWithoutNV) + "s)");

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

    // set the start time of the site navigation without NV emulation
    function setStartNoNV() {
        return new Promise(function(resolve, reject) {
            startNoNV = (new Date()).getTime();
            resolve();
        });
    }

    // set the stop time of the site navigation without NV emulation
    function setStopNoNV() {
        return new Promise(function(resolve, reject) {
            stopNoNV = (new Date()).getTime();
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
        /*****    Part 1 - Navigate to the site without using NV emulation                       *****/
        printPartDescription("------    Part 1 - Navigate to the site without using NV emulation").
        then(buildSeleniumWebDriver).
        then(function() {return setStartNoNV();}).
        then(function() {return seleniumNavigateToPage();}).
        then(function() {return setStopNoNV();}).
        then(driverCloseAndQuit).
        then(printPartSeparator).
        /*****    Part 2 - Navigate to the site using NV "3G Busy" network scenario emulation    *****/
        then(function() {return printPartDescription("------    Part 2 - Navigate to the site using NV \"3G Busy\" network scenario emulation");}).
        then(initTestManager).
        then(setActiveAdapter).
        then(startBusyTest).
        then(function() {return setTestRunning(true);}).
        then(connectToTransactionManager).
        then(function() {return startTransaction();}).
        then(function() {return setTransactionInProgress(true);}).
        then(buildSeleniumWebDriver).
        then(function() {return seleniumNavigateToPage();}).
        then(function() {return stopTransaction();}).
        then(function() {return setTransactionInProgress(false);}).
        then(driverCloseAndQuit).
        then(stopTest).
        then(function() {return setTestRunning(false);}).
        then(printPartSeparator).
        /*****    Part 3 - Analyze the NV test and print the results to the console              *****/
        then(function() {return printPartDescription("------    Part 3 - Analyze the NV test and print the results to the console");}).
        then(analyzeTestJson).
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
