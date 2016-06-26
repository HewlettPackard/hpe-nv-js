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
 This sample demonstrates the use of the most basic NV methods.

 First, the sample creates a TestManager object and initializes it.
 The sample starts an NV test over an emulated "3G Busy" network.
 ("3G Busy" is one of NV's built-in network profiles. A network profile specifies the
 network traffic behavior, including latency, packet loss, and incoming/outgoing bandwidth.
 Network profiles are used to emulate traffic over real-world networks.)

 Next, the sample navigates to the home page in the HPE Network Virtualization website using the Selenium WebDriver.

 Finally, the sample stops the NV test.

 basic_nv_test.js steps:
 1. Create a TestManager object and initialize it.
 2. Start the NV test with the "3G Busy" network scenario.
 3. Build the Selenium WebDriver.
 4. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
 5. Close and quit the Selenium WebDriver.
 6. Stop the NV test.
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
    var testManager, siteTest;
    var driver;
    var testRunning = false;

    // get program arguments
    var useSSL = (program.ssl && program.ssl.toLowerCase() === 'true') ? true: false;
    var serverIp = program.serverIp;
    var serverPort = program.serverPort;
    var username = program.username;
    var password = program.password;
    var proxySetting = program.proxy;
    var browser = program.browser || 'Firefox';
    var debug = (program.debug && program.debug.toLowerCase() === 'true') ? true: false;

    var testDescription = "***   This sample demonstrates the use of the most basic NV methods.                               ***\n" +
                          "***                                                                                                ***\n" +
                          "***   First, the sample creates a TestManager object and initializes it.                           ***\n" +
                          "***   The sample starts an NV test over an emulated \"3G Busy\" network.                             ***\n" +
                          "***   (\"3G Busy\" is one of NV's built-in network profiles. A network profile specifies the         ***\n" +
                          "***   network traffic behavior, including latency, packet loss, and incoming/outgoing bandwidth.   ***\n" +
                          "***   Network profiles are used to emulate traffic over real-world networks.)                      ***\n" +
                          "***                                                                                                ***\n" +
                          "***   Next, the sample navigates to the home page in the HPE Network Virtualization website        ***\n" +
                          "***   using the Selenium WebDriver.                                                                ***\n" +
                          "***                                                                                                ***\n" +
                          "***   Finally, the sample stops the NV test.                                                       ***\n" +
                          "***                                                                                                ***\n" +
                          "***   You can view the actual steps of this sample in the basic_nv_test.js file.                   ***\n";


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

        //stop spinner
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

    // start an NV test with the "3G Busy" network scenario
    function startTest() {
        // create an NV test
        logDebugMessage("Creating the NV test object");
        var testConfig = {
            testManager: testManager,
            testName: "basic_nv_test Sample Test",
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

    // build the Selenium WebDriver
    function buildSeleniumWebDriver() {
        logDebugMessage('Building the Selenium WebDriver for ' + browser);

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

    // set the testRunning Boolean and return a promise object
    function setTestRunning(isTestRunning) {
        return new Promise(function(resolve, reject) {
            testRunning = isTestRunning;
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
        /*****    Part 1 - Create a TestManager object and initialize it                                                               *****/
        printPartDescription("------    Part 1 - Create a TestManager object and initialize it").
        then(initTestManager).
        then(printPartSeparator).
        /*****    Part 2 - Start the NV test with the "3G Busy" network scenario                                                       *****/
        then(function () { return printPartDescription("------    Part 2 - Start the NV test with the \"3G Busy\" network scenario");}).
        then(startTest).
        then(function () {
            return setTestRunning(true);
        }).
        then(printPartSeparator).
        /*****    Part 3 - Navigate to the HPE Network Virtualization website                                                          *****/
        then(function () { return printPartDescription("------    Part 3 - Navigate to the HPE Network Virtualization website");}).
        then(buildSeleniumWebDriver).
        then(function () {
            return seleniumNavigateToPage();
        }).
        then(driverCloseAndQuit).
        then(printPartSeparator).
        /*****    Part 4 - Stop the NV test                                                                                            *****/
        then(function () { return printPartDescription("------    Part 4 - Stop the NV test");}).
        then(stopTest).
        then(function () {
            return setTestRunning(false);
        }).
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
