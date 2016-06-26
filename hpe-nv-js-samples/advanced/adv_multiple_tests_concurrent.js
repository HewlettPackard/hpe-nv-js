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
 This sample shows how to run several tests concurrently with different flow definitions.
 When running NV tests in parallel, make sure that:
 * each test is configured to use multi-user mode
 * the include/exclude IP ranges in the tests' flows do not overlap - this ensures data separation between the tests

 adv_multiple_tests_concurrent.js steps:
 1. Create and initialize the TestManager object.
 2. Set the active adapter.
 3. Start the first NV test with "Flow1" - view the sample's code to see the flow's properties.
 4. Connect the first NV test to the transaction manager.
 5. Start the second NV test with "Flow2" - view the sample's code to see the flow's properties.
 6. Connect the second NV test to the transaction manager.
 7. Start the "Home Page" NV transaction in the first test.
 8. Start the "Home Page" NV transaction in the second test.
 9. Build the Selenium WebDriver.
 10. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 11. Stop the "Home Page" NV transaction in the first test.
 12. Stop the "Home Page" NV transaction in the second test.
 13. Stop the first NV test.
 14. Stop the second NV test.
 15. Analyze the first NV test and get the result as an object or as a .zip file, if the --zip-result-file-path argument is specified.
 16. Print the NV transaction's network time or the location of the .zip file for the first test, if the --zip-result-file-path argument is specified.
 17. Analyze the second NV test and get the result as an object or as a .zip file, if the --zip-result-file-path argument is specified.
 18. Print the NV transaction's network time or the location of the .zip file for the second test, if the --zip-result-file-path argument is specified.
 19. Close and quit the Selenium WebDriver.
 */
var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    proxy = require('selenium-webdriver/proxy'),
    NV = require('hpe-nv-js-api'),
    TestManager = NV.TestManager,
    Test = NV.Test,
    Flow = NV.Flow,
    Transaction = NV.Transaction,
    IPRange = NV.IPRange,
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
    .option('-t, --site-url <siteUrl>', '[optional] Site under test URL. Default: Default: HPE Network Virtualization site URL. If you change this value, make sure to change the --xpath argument too')
    .option('-x, --xpath <xpath>', "[optional] Parameter for driver.isElementPresent(By.xpath(...)) method. Use an xpath expression of some element in the site. Default: //div[@id='content']")
    .option('-a, --active-adapter-ip <activeAdapterIp>', '[optional] Active adapter IP. Default: --server-ip argument')
    .option('-f, --first-zip-result-file-path <firstZipResultFilePath>', "[optional] [optional] File path to store the first test analysis results as a .zip file")
    .option('-s, --second-zip-result-file-path <secondZipResultFilePath>', "[optional] File path to store the second test analysis results as a .zip file")
    .option('-c, --first-test-flow-tcp-port <firstTestFlowTcpPort>', '[optional] TCP port to define in the flow of the first test', parseInt)
    .option('-p, --second-test-flow-tcp-port <secondTestFlowTcpPort>', '[optional] TCP port to define in the flow of the second test', parseInt)
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
    var testManager;
    var driver;
    var testRunning = false, flow1TransactionInProgress = false, flow2TransactionInProgress = false, flow1Test, flow2Test, flow1TestTransaction, flow2TestTransaction;

    // get program args
    var firstZipResultFilePath = program.firstZipResultFilePath;
    var secondZipResultFilePath = program.secondZipResultFilePath;
    var useSSL = (program.ssl && program.ssl.toLowerCase() === 'true') ? true: false;
    var serverIp = program.serverIp;
    var serverPort = program.serverPort;
    var username = program.username;
    var password = program.password;
    var siteUrl = program.siteUrl || 'http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html';
    var xpath = program.xpath || "//div[@id='content']";
    var proxySetting = program.proxy;
    var activeAdapterIp = program.activeAdapterIp || program.serverIp;
    var analysisPorts = program.analysisPorts || [8080, 80];
    var firstTestFlowTcpPort = program.firstTestFlowTcpPort || 8080;
    var secondTestFlowTcpPort = program.secondTestFlowTcpPort || 80;
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***   This sample shows how to run several tests concurrently with different flow definitions.                              ***\n" +
                          "***   When running NV tests in parallel, make sure that:                                                                    ***\n" +
                          "***   * each test is configured to use multi-user mode                                                                      ***\n" +
                          "***   * the include/exclude IP ranges in the tests' flows do not overlap - this ensures data separation between the tests   ***\n" +
                          "***   * your NV Test Manager license supports multiple flows running in parallel                                            ***\n" +
                          "***                                                                                                                         ***\n"+
                          "***   You can view the actual steps of this sample in the adv_multiple_tests_concurrent.js file.                            ***\n";

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
                testManager.stopAllTests().
                    then(function () {
                        return setTestRunning(false);
                    }).
                    then(null,
                    function(error) {
                        console.error("Stop tests failed with error: " + error);
                    });
            } catch(error) {
                console.error("Stop tests failed with error: " + error);
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
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Creating and initializing the TestManager object");
        if (!debug) {
            spinner.start();
        }
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

    // start an NV test according to the specified flow ID
    function startTest(flowId) {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "adv_multiple_tests_concurrent Sample Test - " + flowId,
            networkScenario: "3G Good",
            testMode: Test.MODE.CUSTOM
        };

        var flowConfig = {
            flowId: flowId,
            latency: 80,
            packetloss: 0,
            bandwidthIn: 2000,
            bandwidthOut: 512,
            srcIp: activeAdapterIp
        };

        var flow = new Flow(flowConfig);

        var ipRangeConfig = {
            protocol: IPRange.PROTOCOL.TCP,
            port : ((flowId === 'Flow1') ? firstTestFlowTcpPort: secondTestFlowTcpPort)
        };

        var ipRange = new IPRange(ipRangeConfig);
        flow.includeDestIPRange(ipRange);

        ipRangeConfig = {
            from: activeAdapterIp,
            to: activeAdapterIp
        };
        ipRange = new IPRange(ipRangeConfig);

        flow.excludeDestIPRange(ipRange);

        // start the test
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Starting the NV test with flow \"" + flowId + "\"");
        if (!debug) {
            spinner.start();
        }

        if (flowId === "Flow1") {
            flow1Test = new Test(testConfig);
            flow1Test.addFlow(flow);
            return flow1Test.start();
        }
        else {
            flow2Test = new Test(testConfig);
            flow2Test.addFlow(flow);
            return flow2Test.start();
        }
    }

    // connect the NV test to the transaction manager
	function connectToTransactionManager(flowId) {		
		if (flowId === "Flow1") {
            logDebugMessage("Connecting the NV test \"" + flow1Test.testMetadata.testName + "\" to the transaction manager");
			return flow1Test.connectToTransactionManager();
        }
        else {
			logDebugMessage("Connecting the NV test \"" + flow2Test.testMetadata.testName + "\" to the transaction manager");
			return flow2Test.connectToTransactionManager();
        }		
	}

    // start the "Home Page" NV transaction
    function startTransaction(flowId) {
        // create an NV transaction
        logDebugMessage("Creating the \"Home Page\" transaction");
        var pageTransactionConfig = {};
        pageTransactionConfig.name = "Home Page";
        var pageTransaction;
        var test;
        if (flowId === "Flow1") {
            test = flow1Test;
            flow1TestTransaction = new Transaction(pageTransactionConfig);
            pageTransaction = flow1TestTransaction;
        }
        else {
            test = flow2Test;
            flow2TestTransaction = new Transaction(pageTransactionConfig);
            pageTransaction = flow2TestTransaction;
        }

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"Home Page\" transaction to NV test configured with flow \"" + flowId + "\"");
        return pageTransaction.addToTest(test).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"Home Page\" transaction in the NV test configured with flow \"" + flowId + "\"");
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

        // wait for the specified element to display
        driver.manage().timeouts().pageLoadTimeout(2000000);
        return driver.wait(function () {
            return driver.isElementPresent(By.xpath(xpath));
        }, 1000*60*2);
    }

    // stop the "Home Page" NV transaction
    function stopTransaction(flowId) {
        var pageTransaction;
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping \"Home Page\" transaction in the NV test configured with flow \"" + flowId + "\"");
        if (!debug) {
            spinner.start();
        }
        if (flowId === "Flow1") {
            pageTransaction = flow1TestTransaction;
        }
        else {
            pageTransaction = flow2TestTransaction;
        }
        return pageTransaction.stop();
    }

    // stop the NV test
    function stopTest(flowId) {
        var siteTest;
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the NV test configured with flow \"" + flowId + "\"");
        if (!debug) {
            spinner.start();
        }
        if (flowId === "Flow1") {
            siteTest = flow1Test;
        }
        else {
            siteTest = flow2Test;
        }
        return siteTest.stop();
    }

    // analyze the NV test
    function analyzeTest(flowId) {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Analyzing the NV test configured with flow \"" + flowId + "\"");
        if (!debug) {
            spinner.start();
        }
        var analyzeParams;
        var zipResultFilePath;
        var siteTest;
        if (flowId === "Flow1") {
            zipResultFilePath = firstZipResultFilePath;
            siteTest = flow1Test;
        }
        if (flowId === "Flow2") {
            zipResultFilePath = secondZipResultFilePath;
            siteTest = flow2Test;
        }

        if (zipResultFilePath) {
            analyzeParams = {
                ports: analysisPorts,
                zipResultFilePath: zipResultFilePath
            };
            return siteTest.analyze(analyzeParams).then(printZipLocation);
        }
        else {
            analyzeParams = {
                ports: analysisPorts,
                useJsonFormat: true
            };
            return siteTest.analyze(analyzeParams).then(printNetworkTime);
        }
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

    // print the transaction network time
    function printNetworkTime(analysisResultJsonString) {
        var promise = new Promise(function(resolve, reject) {
            var analysisResultJson = JSON.parse(analysisResultJsonString);
            if (!debug) {
                spinner.stop(true);
            }
            console.log("\"Home Page\" transaction network time: " + analysisResultJson.transactionSummaries[0].properties.networkTime/1000 + "s");
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
    function setTransactionInProgress(isTransactionInProgress, flowId) {
        return new Promise(function(resolve, reject) {
            if (flowId === "Flow1") {
                flow1TransactionInProgress = isTransactionInProgress;
            }
            else {
                flow2TransactionInProgress = isTransactionInProgress;
            }
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
        /*****    Part 1 - Initialize the TestManager object and set the active adapter                                     *****/
        printPartDescription("------    Part 1 - Initialize the TestManager object and set the active adapter").
        then(initTestManager).
        then(setActiveAdapter).
        then(printPartSeparator).
        /*****    Part 2 - Start the first NV test with the flow "Flow1"                                                    *****/
        then(function() {return printPartDescription("------    Part 2 - Start the first NV test with flow \"Flow1\"");}).
        then(function () { return startTest("Flow1");}).
        then(function() { return setTestRunning(true);}).
        then(function() { return connectToTransactionManager("Flow1");}).
        then(printPartSeparator).
        /*****    Part 3 - Start the second NV test with the flow "Flow2"                                                   *****/
        then(function() {return printPartDescription("------    Part 3 - Start the second NV test with flow \"Flow2\"");}).
        then(function () { return startTest("Flow2");}).
        then(function() { return connectToTransactionManager("Flow2");}).
        then(printPartSeparator).
        /*****    Part 4 - Run the "Home Page" transactions in both tests                                                   *****/
        then(function() {return printPartDescription("------    Part 4 - Run the \"Home Page\" transactions in both tests");}).
        then(function () { return startTransaction("Flow1");}).
        then(function() {return setTransactionInProgress(true, "Flow1");}).
        then(function () { return startTransaction("Flow2");}).
        then(function() {return setTransactionInProgress(true, "Flow2");}).
        then(buildSeleniumWebDriver).
        then(seleniumNavigateToPage).
        then(function () { return stopTransaction("Flow1");}).
        then(function() {return setTransactionInProgress(false, "Flow1");}).
        then(function () { return stopTransaction("Flow2");}).
        then(function() {return setTransactionInProgress(false, "Flow2");}).
        then(printPartSeparator).
        /*****    Part 5 - Stop both tests, analyze them and print the results                                              *****/
        then(function() {return printPartDescription("------    Part 5 - Stop both tests, analyze them and print the results");}).
        then(function () { return stopTest("Flow1");}).
        then(function () { return stopTest("Flow2");}).
        then(function() {return setTestRunning(false);}).
        then(function () { return analyzeTest("Flow1");}).
        then(function () { return analyzeTest("Flow2");}).
        then(driverCloseAndQuit).
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
