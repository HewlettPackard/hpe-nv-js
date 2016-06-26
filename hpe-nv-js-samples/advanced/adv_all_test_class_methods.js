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
 This sample demonstrates all of the Test module APIs except for the real-time update API, which is demonstrated in adv_realtime_update.js.
 You can start the test in this sample using either the NTX or Custom modes.

 adv_all_test_class_methods.js steps:
 1. Create and initialize the TestManager object.
 2. Set the active adapter.
 3. Start the NV test with the "3G Good" network scenario.
 4. Connect the NV test to the transaction manager.
 5. Start packet list capture.
 6. Get packet list information and print it to the console (displayed only if the --debug argument is set to true).
 7. Start the "Home Page" NV transaction.
 8. Build the Selenium WebDriver.
 9. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 10. Get the NV test statistics.
 11. Print the Client-in statistics retrieved in the previous step to the console (displayed only if the --debug argument is set to true).
 12. Stop the "Home Page" NV transaction.
 13. Stop the packet list capture.
 14. Get packet list information and print it to the console (displayed only if the --debug argument is set to true).
 15. Disconnect from the transaction manager.
 16. Stop the NV test.
 17. Analyze the NV test and retrieve the result as an object or as a .zip file, if the --zip-result-file-path argument is specified.
 18. Print the NV transaction's network time or the path of the .zip file, if the --zip-result-file-path argument is specified.
 19. Download the specified packet list.
 20. Download the .shunra file.
 21. Close and quit the Selenium WebDriver.
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
    .option('-t, --site-url <siteUrl>', '[optional] Site under test URL. Default: Default: HPE Network Virtualization site URL. If you change this value, make sure to change the --xpath argument too')
    .option('-x, --xpath <xpath>', "[optional] Parameter for driver.isElementPresent(By.xpath(...)) method. Use an xpath expression of some element in the site. Default: //div[@id='content']")
    .option('-a, --active-adapter-ip <activeAdapterIp>', '[optional] Active adapter IP. Default: --server-ip argument')
    .option('-m, --mode <mode>', '[mandatory] Test mode - ntx or custom')
    .option('-n, --ntx-file-path <ntxFilePath>', '[mandatory in ntx mode] File path of an .ntx/.ntxx file - used to start the test in ntx mode')
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
    .option('-p, --packet-list-id <packetListId>', '[optional] A packet list ID used for capturing a specific packet list and downloading its corresponding .shunra file')
    .option('-c, --packet-list-file-path <packetListFilePath>', '[optional] .pcap file path - used to store all captured packet lists')
    .option('-s, --shunra-file-path <shunraFilePath>', "[optional] .shunra file path for download")
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

if (!program.mode) {
    throw new Error("Missing argument: -m/--mode <mode>");
}

if (program.mode.toLowerCase() !== 'custom' && program.mode.toLowerCase() !== 'ntx') {
    throw new Error("The specified test mode is not supported. Supported modes are: ntx or custom");
}

if (program.mode.toLowerCase() === 'ntx' && !program.ntxFilePath) {
   throw new Error("Missing argument -n/--ntx-file-path <ntxFilePath>");
}

if (program.serverIp && program.serverIp === "0.0.0.0") {
    throw new Error('Please replace the server IP argument value (0.0.0.0) with your NV Test Manager IP');
}

// program body
(function(program) {
    var testManager, siteTest, siteTransaction, packetListIdFromInfo;
    var driver;
    var testRunning = false, transactionInProgress = false;

    // get program arguments
    var mode = program.mode.toLowerCase();
    var ntxFilePath = program.ntxFilePath;
    var zipResultFilePath = program.zipResultFilePath;
    var packetListId = program.packetListId;
    var packetListFilePath = program.packetListFilePath;
    var shunraFilePath = program.shunraFilePath;
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
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***   This sample demonstrates all of the Test module APIs except for the real-time update API, which is demonstrated in adv_realtime_update.js.   ***\n" +
                          "***   You can start the test in this sample using either the NTX or Custom modes.                                                                  ***\n" +
                          "***                                                                                                                                                ***\n" +
                          "***   You can view the actual steps of this sample in the adv_all_test_class_methods.js file.                                                      ***\n";

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
            //stop spinner
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

    // start an NV test with the "3G Good" network scenario
    function startTest() {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "adv_all_test_class_methods Sample Test",
            networkScenario: "3G Good"
        };
        if (mode === 'custom') {
            testConfig.testMode = Test.MODE.CUSTOM;
        }
        if (mode === 'ntx') {
            testConfig.testMode = Test.MODE.NTX;
            testConfig.ntxxFilePath = ntxFilePath;
        }

        siteTest = new Test(testConfig);

        if (mode === 'custom') {
            // add a flow to the test
            logDebugMessage("Adding a flow to the NV test");
            var flowConfig = {
                flowId: "Flow1",
                latency: 80,
                packetloss: 0,
                bandwidthIn: 2000,
                bandwidthOut: 512
            };
            var flow = new Flow(flowConfig);
            siteTest.addFlow(flow);
        }

        // start the test
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Starting the NV test in \"" + mode + "\" mode with the \"3G Good\" network scenario");
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

    // start capturing the specified packet list, or all of the packet lists in the NV test if no packet list ID is specified
    function startPacketListCapture() {
        if (packetListId) {
            // start capturing the packet list with the specified packet list ID
            logDebugMessage("Starting to capture the following packet list: \"" + packetListId + "\"");
            var startPLCaptureParams = {
                packetListId: packetListId
            };
            return siteTest.startPacketListCapture(startPLCaptureParams);
        }
        else {
            // start capturing all of the packet lists in the NV test
            logDebugMessage("Starting to capture all packet lists in the NV test");
            return siteTest.startPacketListCapture();
        }
    }

    // get packet lists information
    function getPacketListInfo() {
        if (packetListId) {
            // get packet list information for the specified packet list
            logDebugMessage("Getting information for the following packet list: \"" + packetListId + "\"");
            var getPLInfoParams = {
                packetListId: packetListId
            };

            return siteTest.getPacketListInfo(getPLInfoParams);
        }
        else {
            // get all packet lists information
            logDebugMessage("Getting information for all packet lists in the NV test");
            return siteTest.getPacketListInfo();
        }
    }

    // print the packet list information to the console
    function printPacketListInfo(packetListInfo) {
        var promise = new Promise(function(resolve, reject) {
            var packetListsInfoArray = packetListInfo.packetListsInfo;

            for (var i = 0; i < packetListsInfoArray.length; i++) {
                if (i == 0) {
                    logDebugMessage("Packet list information:");
                    packetListIdFromInfo = packetListsInfoArray[i].plId;
                }
                logDebugMessage("---- Flow ID: '" +  packetListsInfoArray[i].flowId + "', " +
                    "Packet List ID: '" + packetListsInfoArray[i].plId + "', " +
                    "Capture Status: '" + packetListsInfoArray[i].captureStatus + "'");
            }

            resolve();
        });

        return promise;
    }

    // start the "Home Page" NV transaction
    function startTransaction() {
        // create an NV transaction
        logDebugMessage("Creating the \"Home Page\" transaction");
        var transactionConfig = {};
        transactionConfig.name = "Home Page";
        siteTransaction = new Transaction(transactionConfig);

        // add the NV transaction to the NV test
        logDebugMessage("Adding the \"Home Page\" transaction to the NV test");
        return siteTransaction.addToTest(siteTest).
            then(function() {
                // start the NV transaction
                if (!debug) {
                    spinner.stop(true);
                }
                console.log("Starting the \"Home Page\" transaction");
                if (!debug) {
                    spinner.start();
                }
                return siteTransaction.start();
            });
    }

    // build the Selenium WebDriver
    function buildSeleniumWebDriver() {
        logDebugMessage("Building the Selenium WebDriver for " + browser);
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

    // get the NV test statistics
    function getTestStatistics() {
        logDebugMessage("Getting the NV test statistics");
        var flowStatsParams = {
            flows: ["Flow1"]
        };

        return siteTest.getFlowStatistics(flowStatsParams);
    }

    // print the Client-in statistics retrieved in the previous step to the console
    function printClientInStats(statsJson) {
        var promise = new Promise(function(resolve, reject) {
            var statsArray = statsJson.statistics;

            if (statsArray.length === 0) {
                logDebugMessage("No statistics available. Try again later.");
            }
            else {
                logDebugMessage("Client-in statistics:");
                var statsInTimestamp;
                for (var i = 0; i < statsArray.length; i++) {
                    statsInTimestamp = statsArray[i];
                    logDebugMessage("---- Statistics collected for the following timestamp: " + statsInTimestamp.timeStamp + " ----");
                    for (var j = 0; j < statsInTimestamp.flowStats.length; j++) {
                        logDebugMessage("-------- Flow \"" + statsInTimestamp.flowStats[j].id + "\" client-in statistics: throughput - " + statsInTimestamp.flowStats[j].clientDownStats.bps +
                            ", bandwidth utilization - " + statsInTimestamp.flowStats[j].clientDownStats.bwUtil + ", total throughput - " + statsInTimestamp.flowStats[j].clientDownStats.total);
                    }
                }
                logDebugMessage("Last statistics timestamp: " + siteTest.lastStatsTimestamp);
            }
            resolve();
        });

        return promise;
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
        return siteTransaction.stop();
    }

    // disconnect from the transaction manager
    function disconnectFromTransactionManager() {
        logDebugMessage("Disconnecting from the transaction manager");
        return siteTest.disconnectFromTransactionManager();
    }

    // stop capturing packet lists
    function stopPacketListCapture() {
        if (packetListId) {
            // stop capturing the packet list with the specified packet list ID
            logDebugMessage("Stopping packet list capture for the following packet list: \"" + packetListId + "\"");
            var stopPLCaptureParams = {
                packetListId: packetListId
            };
            return siteTest.stopPacketListCapture(stopPLCaptureParams);
        }
        else {
            // stop capturing all packet lists of the NV test
            logDebugMessage("Stopping packet list capture for all of the packet lists in the NV test");
            return siteTest.stopPacketListCapture();
        }
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

    // analyze the NV test
    function analyzeTest() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Analyzing the NV test");
        if (!debug) {
            spinner.start();
        }

        var analyzeParams;
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

    // download the specified packet list
    function downloadPacketList() {
        if (!debug) {
            spinner.stop(true);
        }
        console.log("Downloading the following packet list: \"" +  (packetListId || packetListIdFromInfo) + "\"");
        if (!debug) {
            spinner.start();
        }
        var downloadPLParams = {
            packetListId: packetListId || packetListIdFromInfo
        };
        if (packetListFilePath) {
            downloadPLParams.packetListFilePath = packetListFilePath;
        }
        return siteTest.downloadPacketList(downloadPLParams).then(printPacketListFileLocation);
    }

    // print the path of the downloaded packet list file
    function printPacketListFileLocation(packetListFileLocation) {
        var promise = new Promise(function(resolve, reject) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log("Downloaded packet list file path: " + packetListFileLocation);
            if (!debug) {
                spinner.start();
            }
            resolve();
        });

        return promise;
    }

    // download a .shunra file that contains the specified packet list or all of the captured packet lists, if no packet list ID is specified
    function downloadShunra() {
        var downloadShunraParams = {};
        if (!debug) {
            spinner.stop(true);
        }

        if (packetListId) {
            downloadShunraParams.packetListId = packetListId;
            console.log("Downloading a .shunra file for the following packet list: '" +  packetListId + "'");
        }
        else {
            console.log("Downloading a .shunra file for all of the packet lists captured during the test");
        }

        if (!debug) {
            spinner.start();
        }

        if (shunraFilePath) {
            downloadShunraParams.shunraFilePath = shunraFilePath;
        }

        return siteTest.downloadShunra(downloadShunraParams).then(printShunraFileLocation);
    }

    // print the path of the downloaded .shunra file
    function printShunraFileLocation(shunraFileLocation) {
        var promise = new Promise(function(resolve, reject) {
            if (!debug) {
                spinner.stop(true);
            }
            console.log("Downloaded .shunra file path: " + shunraFileLocation);
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
        /*****    Part 1 - Initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on                                                      *****/
        printPartDescription("------    Part 1 - Initialize the TestManager object to pass logon credentials, the NV Test Manager IP, the port, and so on").
        then(initTestManager).
        then(printPartSeparator).
        /*****    Part 2 - Set the active adapter and start the NV test                                                                                                                  *****/
        then(function() {return printPartDescription("------    Part 2 - Set the active adapter and start the NV test");}).
        then(setActiveAdapter).
        then(startTest).
        then(function() {return setTestRunning(true);}).
        then(connectToTransactionManager).
        then(printPartSeparator).
        /*****    Part 3 - Start packet list capture, get the packet list information and print it to the console (if the --debug argument is set to true)                               *****/
        then(function() {return printPartDescription("------    Part 3 - Start packet list capture, get the packet list information and print it to the console (if the --debug argument is set to true)");}).
        then(startPacketListCapture).
        then(getPacketListInfo).
        then(printPacketListInfo).
        then(printPartSeparator).
        /*****    Part 4 - Start the NV transaction and navigate to the site                                                                                                             *****/
        then(function() {return printPartDescription("------    Part 4 - Start the NV transaction and navigate to the site");}).
        then(startTransaction).
        then(function() {return setTransactionInProgress(true);}).
        then(buildSeleniumWebDriver).
        then(seleniumNavigateToPage).
        then(printPartSeparator).
        /*****    Part 5 - Get the NV test statistics and print the Client-in statistics to the console (if the --debug argument is set to true)                                         *****/
        then(function() {return printPartDescription("------    Part 5 - Get the NV test statistics and print the Client-in statistics to the console (if the --debug argument is set to true)");}).
        then(getTestStatistics).
        then(printClientInStats).
        then(printPartSeparator).
        /*****    Part 6 - Stop the NV transaction and the packet list capture, get the packet list information and print it to the console (if the --debug argument is set to true)     *****/
        then(function() {return printPartDescription("------    Part 6 - Stop the NV transaction and the packet list capture, get the packet list information and print it to the console (if the --debug argument is set to true)");}).
        then(stopTransaction).
        then(function() {return setTransactionInProgress(false);}).
        then(stopPacketListCapture).
        then(getPacketListInfo).
        then(printPacketListInfo).
        then(printPartSeparator).
        /*****    Part 7 - Disconnect from the transaction manager and stop the NV test                                                                                                  *****/
        then(function() {return printPartDescription("------    Part 7 - Disconnect from the transaction manager and stop the NV test");}).
        then(disconnectFromTransactionManager).
        then(stopTest).
        then(function() {return setTestRunning(false);}).
        then(printPartSeparator).
        /*****    Part 8 - Analyze the NV test and print the results to the console                                                                                                      *****/
        then(function() {return printPartDescription("------    Part 8 - Analyze the NV test and print the results to the console");}).
        then(analyzeTest).
        then(printPartSeparator).
        /*****    Part 9 - Download the specified packet list and the .shunra file                                                                                                      *****/
        then(function() {return printPartDescription("------    Part 9 - Download the specified packet list and the .shunra file");}).
        then(downloadPacketList).
        then(downloadShunra).
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
