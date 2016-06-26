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
 This sample demonstrates all of the TestManager module APIs. These APIs let you:
 * initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on
 * set/get the NV configuration and active adapter
 * get the running tests tokens
 * start/stop packet list capture
 * get packet list information
 * stop a specified array of tests or all of the running tests
 * analyze a .shunra file, which is a compressed file that includes an events file, metadata, and packet lists

 adv_all_testmanager_class_methods.js steps:
 1. Create and initialize the TestManager object.
 2. Set the active adapter.
 3. Get the active adapter and print its properties to the console (displayed only if the --debug argument is set to true).
 4. Set the NV configuration.
 5. Get the NV configuration and print its properties to the console (displayed only if the --debug argument is set to true).
 6. Start the first NV test with "Flow1" - view the sample's code to see the flow's properties.
 7. Connect the first NV test to the transaction manager.
 8. Start the second NV test with "Flow2" - view the sample's code to see the flow's properties.
 9. Connect the second NV test to the transaction manager.
 10. Get the running tests tokens and print them to the console (displayed only if the --debug argument is set to true).
 11. Start the "Home Page" NV transaction in the first test.
 12. Start the "Home Page" NV transaction in the second test.
 13. Start capturing all packet lists in all running tests.
 14. Build the Selenium WebDriver.
 15. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 16. Get packet list information and print it to the console (displayed only if the --debug argument is set to true).
 17. Stop capturing all packet lists in all running tests.
 18. Stop the "Home Page" NV transaction in the first test.
 19. Stop the "Home Page" NV transaction in the second test.
 20. Stop the first NV test using the "stopTests" TestManager module API.
 21. Stop all tests using the "stopAllTests" TestManager module API.
 22. Analyze the specified .shunra file and get the result as an object or as a .zip file, if the --zip-result-file-path argument is specified.
 23. Print the network times of the transactions in the .shunra file, or the path of the .zip file, if the --zip-result-file-path argument is specified.
 24. Close and quit the Selenium WebDriver.
 */
var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    proxy = require('selenium-webdriver/proxy'),
    NV = require('hpe-nv-js-api'),
    TestManager = NV.TestManager,
    Test = NV.Test,
    Flow = NV.Flow,
    IPRange = NV.IPRange,
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
    .option('-t, --site-url <siteUrl>', '[optional] Site under test URL. Default: HPE Network Virtualization site URL. If you change this value, make sure to change the --xpath argument too')
    .option('-x, --xpath <xpath>', "[optional] Parameter for driver.isElementPresent(By.xpath(...)) method. Use an xpath expression of some element in the site. Default: //div[@id='content]")
    .option('-a, --active-adapter-ip <activeAdapterIp>', '[optional] Active adapter IP. Default: --server-ip argument')
    .option('-s, --shunra-file-path <shunraFilePath>', "[optional] File path for the .shunra file to analyze")
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
    .option('-f, --first-test-flow-tcp-port <firstTestFlowTcpPort>', '[optional] TCP port for the flow of the first test', parseInt)
    .option('-g, --second-test-flow-tcp-port <secondTestFlowTcpPort>', '[optional] TCP port for the flow of the second test', parseInt)
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
    var testManager, siteTest1, siteTest2, siteTransaction1, siteTransaction2;
    var driver;

    // get program arguments
    var useSSL = (program.ssl && program.ssl.toLowerCase() === 'true') ? true: false;
    var serverIp = program.serverIp;
    var serverPort = program.serverPort;
    var username = program.username;
    var password = program.password;
    var siteUrl = program.siteUrl || 'http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html';
    var xpath = program.xpath || "//div[@id='content']";
    var proxySetting = program.proxy;
    var activeAdapterIp = program.activeAdapterIp || program.serverIp;
    var shunraFilePath = program.shunraFilePath;
    var analysisPorts = program.analysisPorts || [8080, 80];
    var zipResultFilePath = program.zipResultFilePath;
    var firstTestFlowTcpPort = program.firstTestFlowTcpPort || 8080;
    var secondTestFlowTcpPort = program.secondTestFlowTcpPort || 80;
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***   This sample demonstrates all of the TestManager module APIs. These APIs let you:                                ***\n" +
                          "***   * initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on      ***\n" +
                          "***   * set/get the NV configuration and active adapter                                                               ***\n" +
                          "***   * get the running tests tokens                                                                                  ***\n" +
                          "***   * start/stop packet list capture                                                                                ***\n" +
                          "***   * get packet list information                                                                                   ***\n" +
                          "***   * stop a specified array of tests or all of the running tests                                                   ***\n" +
                          "***   * analyze a .shunra file, which is a compressed file that includes an events file, metadata, and packet lists   ***\n" +
                          "***                                                                                                                   ***\n" +
                          "***   You can view the actual steps of this sample in the adv_all_testmanager_class_methods.js file.                  ***\n";

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

        if (siteTest1 || siteTest2) {
            try {
                testManager.stopAllTests().
                    then(function () {
                        return setObjectToNull("siteTest1").then(function() { return setObjectToNull("siteTest2");});
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
            // stop spinner
            if (!debug) {
                spinner.stop(true);
            }

            console.log("Sample execution ended successfully");
            if (driver) {
                driver.close();
                driver.quit();
                driver = null;
            }
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

    // get the active adapter
    function getActiveAdapter() {
        logDebugMessage("Getting the active adapter");
        return testManager.getActiveAdapter();
    }

    // print the active adapter properties to the console
    function printActiveAdapter(activeAdapterJson) {
        var promise = new Promise(function(resolve, reject) {
            logDebugMessage('Active adapter IP: ' + activeAdapterJson.ip + ", Active adapter reverseDirection Boolean value: " + activeAdapterJson.reverseDirection);
            resolve();
        });

        return promise;
    }

    // set the NV configuration
    function setConfiguration() {
        logDebugMessage("Setting the NV configuration");
        var configurationParams = {
            isPacketListCaptureCyclic: false,
            packetListMaxSizeMB: 350,
            packetListServerClientRatio: 10
        };

        return testManager.setConfiguration(configurationParams);
    }

    // get the NV configuration
    function getConfiguration() {
        logDebugMessage("Getting the NV configuration");
        return testManager.getConfiguration();
    }

    // print the NV configuration to the console
    function printConfiguration(configurationJson) {
        var promise = new Promise(function(resolve, reject) {
            logDebugMessage('Configuration - isPacketListCaptureCyclic:' + configurationJson.isPacketListCaptureCyclic + ', packetListMaxSizeMB: ' + configurationJson.packetListMaxSizeMB +
                        ', packetListServerClientRatio: ' + configurationJson.packetListServerClientRatio);
            resolve();
        });

        return promise;
    }

    // start the first NV test with the "3G Good" network scenario
    function startTest1() {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "adv_all_testmanager_class_methods Sample Test 1",
            networkScenario: '3G Good',
            testMode: Test.MODE.CUSTOM
        };

        siteTest1 = new Test(testConfig);

        // add a flow to the test
        logDebugMessage("Adding a flow to the NV test");

        var flowConfig = {
            flowId: "Flow1",
            latency: 80,
            packetloss: 0,
            bandwidthIn: 2000,
            bandwidthOut: 512,
            srcIp: activeAdapterIp
        };

        var flow = new Flow(flowConfig);

        var ipRangeConfig = {
            protocol: IPRange.PROTOCOL.TCP,
            port : firstTestFlowTcpPort
        };

        var ipRange = new IPRange(ipRangeConfig);
        flow.includeDestIPRange(ipRange);

        ipRangeConfig = {
            from: activeAdapterIp,
            to: activeAdapterIp
        };
        ipRange = new IPRange(ipRangeConfig);

        flow.excludeDestIPRange(ipRange);
        siteTest1.addFlow(flow);

        // start the test
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Starting the \"" + siteTest1.testMetadata.testName + "\" test with \"Flow1\" flow");
        if (!debug) {
            spinner.start();
        }
        return siteTest1.start();
    }

    // clone the first NV test to create the second NV test and
    // start the second NV test with the "3G Good" network scenario
    function startTest2() {
        // create an NV test
        logDebugMessage("Creating the NV test object using the clone method");
        siteTest2 = siteTest1.clone();
        siteTest2.testMetadata.testName = "adv_all_testmanager_class_methods Sample Test 2";
        siteTest2.flows = [];

        // add a flow to the test
        logDebugMessage("Adding a flow to the NV test");

        var flowConfig = {
            flowId: "Flow2",
            latency: 80,
            packetloss: 0,
            bandwidthIn: 2000,
            bandwidthOut: 512,
            srcIp: activeAdapterIp
        };

        var flow = new Flow(flowConfig);

        var ipRangeConfig = {
            protocol: IPRange.PROTOCOL.TCP,
            port : secondTestFlowTcpPort
        };

        var ipRange = new IPRange(ipRangeConfig);
        flow.includeDestIPRange(ipRange);

        ipRangeConfig = {
            from: activeAdapterIp,
            to: activeAdapterIp
        };
        ipRange = new IPRange(ipRangeConfig);

        flow.excludeDestIPRange(ipRange);
        siteTest2.addFlow(flow);

        // start the test
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Starting the \"" + siteTest2.testMetadata.testName + "\" test with \"Flow2\" flow");
        if (!debug) {
            spinner.start();
        }
        return siteTest2.start();
    }

    // get the tokens of the running tests
    function getTestTokens() {
        logDebugMessage("Getting the tokens of the running tests");
        return testManager.getTestTokens();
    }

    // print the tokens of the running tests to the console
    function printTestTokens(testTokensJson) {
        var promise = new Promise(function(resolve, reject) {
            logDebugMessage("Test tokens:" + JSON.stringify(testTokensJson));
            resolve();
        });

        return promise;
    }

    // connect the first NV test to the transaction manager
	function connectTest1ToTransactionManager() {
		logDebugMessage("Connecting the \"" +  siteTest1.testMetadata.testName + "\" test to the transaction manager");
        return siteTest1.connectToTransactionManager();	
	}

    // connect the second NV test to the transaction manager
	function connectTest2ToTransactionManager() {
		logDebugMessage("Connecting the \"" +  siteTest2.testMetadata.testName + "\" test to the transaction manager");
        return siteTest2.connectToTransactionManager();	
	}

    // start the "Home Page" NV transaction in the first test
    function startTransaction1() {
        // create an NV transaction
        logDebugMessage("Creating the \"Home Page\" transaction for the \"" + siteTest1.testMetadata.testName + "\" test");
        var transactionConfig = {};
        transactionConfig.name = "Home Page";

        siteTransaction1 = new Transaction(transactionConfig);

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"Home Page\" transaction to the \"" +  siteTest1.testMetadata.testName + "\" test");
        return siteTransaction1.addToTest(siteTest1).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"Home Page\" transaction in the \"" + siteTest1.testMetadata.testName + "\" test");
                if (!debug) {
                    spinner.start();
                }
                return siteTransaction1.start();
            });
    }

    // start the "Home Page" NV transaction in the second test
    function startTransaction2() {
        // create an NV transaction
        logDebugMessage("Creating the \"Home Page\" transaction for the \"" + siteTest2.testMetadata.testName + "\" test");
        siteTransaction2 = siteTransaction1.clone();

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"Home Page\" transaction to the \"" +  siteTest2.testMetadata.testName + "\" test");
        return siteTransaction2.addToTest(siteTest2).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"Home Page\" transaction in the \"" + siteTest2.testMetadata.testName + "\" test");
                if (!debug) {
                    spinner.start();
                }
                return siteTransaction2.start();
            });
    }

    // start capturing all packet lists in all running tests
    function startPacketListCapture() {
        logDebugMessage("Starting the packet list capture in all running tests");
        return testManager.startPacketListCapture();
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

    // stop capturing all packet lists in all running tests
    function stopPacketListCapture() {
        logDebugMessage("Stopping the packet list capture in all running tests");
        return testManager.stopPacketListCapture();
    }

    // get the packet list information
    function getPacketListInfo() {
        logDebugMessage("Getting the packet list information for all packet lists in all of the tests");
        return testManager.getPacketListInfo();
    }

    // print the packet list information to the console
    function printPacketListInfo(packetListInfo) {
        var promise = new Promise(function(resolve, reject) {
            var packetListsInfoArray = packetListInfo.packetListsInfo;

            if (packetListsInfoArray.length == 0) {
                logDebugMessage("No packet list information is available.");
            }

            for (var i = 0; i < packetListsInfoArray.length; i++) {
                if (i == 0) {
                    logDebugMessage("Packet list information:");
                }
                logDebugMessage("---- Flow ID: \"" +  packetListsInfoArray[i].flowId + "\", " +
                    "Packet List ID: \"" + packetListsInfoArray[i].plId + "\", " +
                    "Capture Status: \"" + packetListsInfoArray[i].captureStatus + "\"");
            }

            resolve();
        });

        return promise;
    }

    // stop the "Home Page" NV transaction in the first NV test
    function stopTransaction1() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the \"Home Page\" transaction of the \"" +  siteTest1.testMetadata.testName + "\" test");
        if (!debug) {
            spinner.start();
        }
        return siteTransaction1.stop();
    }

    // stop the "Home Page" NV transaction in the second NV test
    function stopTransaction2() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stopping the \"Home Page\" transaction of the \"" +  siteTest2.testMetadata.testName + "\" test");
        if (!debug) {
            spinner.start();
        }
        return siteTransaction2.stop();
    }

    // stop the NV test
    function stopTest1() {
        logDebugMessage("Stopping tests: [" + siteTest1.testMetadata.testName + "]");
        var stopTestsParams = {
            tests: [siteTest1]
        };
        return testManager.stopTests(stopTestsParams);
    }

    // stop all running tests
    function stopAllTests() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Stop all running tests");
        if (!debug) {
            spinner.start();
        }
        return testManager.stopAllTests();
    }

    // analyze the specified .shunra file
    function analyzeShunra() {
        if (shunraFilePath) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log("Analyzing the specified .shunra file");
            if (!debug) {
                spinner.start();
            }

            var analyzeParams;
            if (zipResultFilePath) {
                analyzeParams = {
                    ports: analysisPorts,
                    zipResultFilePath: zipResultFilePath,
                    shunraFilePath: shunraFilePath
                };
                return testManager.analyzeShunraFile(analyzeParams).then(printZipLocation);
            }
            else {
                analyzeParams = {
                    ports: analysisPorts,
                    useJsonFormat: true,
                    shunraFilePath: shunraFilePath
                };
                return testManager.analyzeShunraFile(analyzeParams).then(printNetworkTime);
            }
        }
        else {
            new Promise(function(resolve, reject) { resolve();});
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

    // print the network times of the transactions in the .shunra file
    function printNetworkTime(analysisResultJsonString) {
        var promise = new Promise(function(resolve, reject) {
            var analysisResultJson = JSON.parse(analysisResultJsonString);

            // stop spinner
            if (!debug) {
                spinner.stop(true);
            }

            console.log("\n");
            console.log("Network times for all transactions in the specified .shunra file in seconds:");

            for (var i = 0; i < analysisResultJson.transactionSummaries.length; i++) {
                console.log("--- \"" + analysisResultJson.transactionSummaries[i].properties.transactionName + "\" transaction network time: " + analysisResultJson.transactionSummaries[i].properties.networkTime/1000 + "s");
            }

            if (!debug) {
                spinner.start();
            }

            resolve();
        });

        return promise;
    }

    // set the specified object to null
    function setObjectToNull(objName) {
        var promise = new Promise(function(resolve, reject) {
            if (objName === "siteTest1") {
                siteTest1 = null;
            }
            if (objName === "siteTest2") {
                siteTest2 = null;
            }
            if (objName === "siteTransaction1") {
                siteTransaction1 = null;
            }
            if (objName === "siteTransaction2") {
                siteTransaction2 = null;
            }
            resolve();
        });
        return promise;
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
        /*****    Part 1 - Initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on                     *****/
        printPartDescription("------    Part 1 - Initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on").
        then(initTestManager).
        then(printPartSeparator).
        /*****    Part 2 - Set/get the NV configuration and active adapter                                                                              *****/
        then(function() {return printPartDescription("------    Part 2 - Set/get the NV configuration and active adapter");}).
        then(setActiveAdapter).
        then(getActiveAdapter).
        then(printActiveAdapter).
        then(setConfiguration).
        then(getConfiguration).
        then(printConfiguration).
        then(printPartSeparator).
        /*****    Part 3 - Start tests and get the NV tests' tokens                                                                                     *****/
        then(function() {return printPartDescription("------    Part 3 - Start tests and get the NV tests' tokens");}).
        then(startTest1).
        then(connectTest1ToTransactionManager).
        then(startTest2).
        then(connectTest2ToTransactionManager).
        then(getTestTokens).
        then(printTestTokens).
        then(printPartSeparator).
        /*****    Part 4 - Start NV transactions, navigate to the site and start capturing the packet lists                                             *****/
        then(function() {return printPartDescription("------    Part 4 - Start NV transactions, navigate to the site and start capturing the packet lists");}).
        then(startTransaction1).
        then(startTransaction2).
        then(startPacketListCapture).
        then(buildSeleniumWebDriver).
        then(seleniumNavigateToPage).
        then(printPartSeparator).
        /*****    Part 5 - Get the packet list information and print it to the console (if the --debug argument is set to true)                         *****/
        then(function() {return printPartDescription("------    Part 5 - Get the packet list information and print it to the console (if the --debug argument is set to true)");}).
        then(getPacketListInfo).
        then(printPacketListInfo).
        then(printPartSeparator).
        /*****    Part 6 - Stop capturing packet lists and stop the NV transactions                                                                     *****/
        then(function() {return printPartDescription("------    Part 6 - Stop capturing packet lists and stop the NV transactions");}).
        then(stopPacketListCapture).
        then(stopTransaction1).
        then(function() { return setObjectToNull("siteTransaction1");}).
        then(stopTransaction2).
        then(function() { return setObjectToNull("siteTransaction2");}).
        then(printPartSeparator).
        /*****    Part 7 - Stop the first NV test using the "stopTests" method and then stop the second test using the "stopAllTests" method            *****/
        then(function() {return printPartDescription("------    Part 7 - Stop the first NV test using the \"stopTests\" method and then stop the second test using the \"stopAllTests\" method");}).
        then(stopTest1).
        then(function() { return setObjectToNull("siteTest1");}).
        then(function() { return driver.sleep(30000);}).
        then(stopAllTests).
        then(function() { return setObjectToNull("siteTest1");}).
        then(function() { return setObjectToNull("siteTest2");}).
        then(printPartSeparator).
        /*****    Part 8 - Analyze the specified .shunra file and print the results to the console                                                      *****/
        then(function() {return printPartDescription("------    Part 8 - Analyze the specified .shunra file and print the results to the console");}).
        then(analyzeShunra).
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
