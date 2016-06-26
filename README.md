# HPE Network Virtualization API Node.js Module
Applications are often not designed to handle slow networks. Network Virtualization (NV) helps you to understand how slow networks affect your application's performance and what you can do to optimize client and server performance in your application. 

Do your customers complain that your application works slowly? Are there timeout exceptions? Has your application ever failed when moved to production, even though the application worked perfectly when tested under lab conditions? Does your application suffer from non-reproducible issues?

The NV API lets you test your application behavior under various network conditions, analyze performance results, and view optimization recommendations for improving application performance.

Learn more about NV at http://nvhelp.saas.hpe.com/en/9.10.  

This Node.js Module lets you call the NV API in your automatic tests (for example, your Selenium tests). You can use this API instead of using the NV Test Manager user interface. 

This Readme includes the following topics:
* Prerequisites
* Installation
* Usage
* Get Started
* Modules:
  * TestManager Module
  * Test Module
  * Transaction Module
  * IPRange Module
  * Range Module
  * Flow Module
* Enums
* Samples:
  * Basic Step-by-Step Samples:
    * basic_nv_test.js
	* basic_analyze_nv_test.js	
    * basic_comparison_without_nv.js
	* basic_analyze_nv_transactions.js
    * basic_analyze_2_scenarios.js
  * Advanced Samples:
    * adv_all_test_class_methods.js
    * adv_realtime_update.js
    * adv_all_testmanager_class_methods.js
    * adv_multiple_tests_sequential.js
    * adv_multiple_tests_concurrent.js
* Debugging
* License

## Prerequisites
* Node.js 4.2.4 (or later) installed and available in your $PATH  
* NV Test Manager 9.10 or later  
* To try the samples, use a Chrome or Firefox browser.  
  __Note:__ If you are using Chrome, download ChromeDriver (https://sites.google.com/a/chromium.org/chromedriver/) and add it to your $PATH.

## Installation
	 $ npm install hpe-nv-js-api
	 
## Usage
* To try the samples (located in https://github.com/HewlettPackard/hpe-nv-js):
  * _npm install_ the __package.json__ of the hpe-nv-js-samples module.  
  * Run the batch files.  
  * To read more about the samples, go to the "Samples" section below.  
* To create a custom test of your own and use the NV Node.js Module:
  * Create a Node.js Module and use the following dependency in your module's package.json: 
  
    ```
    {
      ...
      "dependencies": {
	    "hpe-nv-js-api": "1.0.0",
	    ...
      }
    }
    ```
  * Require the "hpe-nv-js-api" node module. To use a specific module, such as the "TestManager" module, assign it to a new variable, for example:
  
    ```js
    var NV = require('hpe-nv-js-api'),
        TestManager = NV.TestManager,
        Test = NV.Test,
	    Transaction = NV.Transaction,
        Flow = NV.Flow,    
        IPRange = NV.IPRange,
	    Range = NV.Range;
    ```	 

## Get Started
Try a few basic samples (under the _\hpe-nv-js-samples\basic_ folder). The "Samples" section below describes all of our samples. For example, start with basic_nv_test.js and basic_analyze_nv_test.js.

Here's a basic code example that shows how to start a test in NV, run a transaction, stop the transaction, stop the test, and finally analyze the test results. This example shows how to create a home page transaction, but you can create any type of transaction, such as a search transaction.    


```js
var testManager, siteTest, pageTransaction;

// Create and initialize the TestManager object
function initTestManager() {
	// create a TestManager object
	var testManagerConfig = {
		serverIP: serverIp,
		serverPort: serverPort,
		username: "username",
		password: "password"
	};
	testManager = new TestManager(testManagerConfig);
	// call the init method
	return testManager.init();
}

// start an NV test with the "3G Busy" network scenario
function startBusyTest() {
	// create an NV test
	var testConfig = {
		testManager: testManager,
		testName: "Basic Test",
		networkScenario: "3G Busy",
		testMode: Test.MODE.CUSTOM
	};
	siteTest = new Test(testConfig);

	// add a flow to the test
	var flowConfig = {
		flowId: "Flow1",
		latency: 200,
		packetloss: 0.5,
		bandwidthIn: 384,
		bandwidthOut: 128
	};
	var flow = new Flow(flowConfig);

	// start the test
	return siteTest.start();
}

// connect the NV test to the transaction manager
function connectToTransactionManager() {
	return siteTest.connectToTransactionManager();
}

// start the "Home Page" NV transaction
function startTransaction() {
	// create an NV transaction	
	var pageTransactionConfig = {};
	pageTransactionConfig.name = 'Home Page';
	pageTransaction = new Transaction(pageTransactionConfig);

	// add and start the NV transaction	
	return pageTransaction.addToTest(siteTest).
		then(function() {
			return pageTransaction.start();
		});
}

// navigate to the site's home page using the Selenium WebDriver
function seleniumNavigateToPage() {
	// insert your Selenium code to navigate to your site's home page
	...
}

// stop the "Home Page" NV transaction
function stopTransaction() { 
	return pageTransaction.stop();
}

// stop the NV test
function stopTest() {
	return siteTest.stop();
}

// analyze the NV test and get the result as a JSON string
function analyzeTest() {
	var analyzeParams = {
		ports: [80, 8080],
		useJsonFormat: true
	};
	return siteTest.analyze(analyzeParams).then(printNetworkTime);
}

// print the transaction's network time
function printNetworkTime(analysisResultJsonString) {
	var promise = new Promise(function(resolve, reject) {
		var analysisResultJson = JSON.parse(analysisResultJsonString);
		console.log("Network time extracted from analysis report:" + analysisResultJson.transactionSummaries[0].properties.networkTime);
		resolve();
	});

	return promise;
}

// handle error
function handleError(errorMessage) {
    console.error("Error occurred: " + errorMessage);
}

initTestManager().
then(startBusyTest).
then(connectToTransactionManager).
then(startTransaction).
then(seleniumNavigateToPage).
then(stopTransaction).
then(stopTest).
then(analyzeTest).
then(printNetworkTime).
then(null, handleError);
```	 
 
 
## Modules
This section describes the library's modules - including their methods, exceptions, and so on.  
__Note:__ Methods not described in this section are for internal use only.  
 
### TestManager Module
This module represents a connection instance to a specific NV Test Manager.  
__Important note:__ If you are using a secure Test Manager installation, set the "useSSL" property to __true__ in the configuration object passed to the constructor.  
This module includes the following methods:  
* __TestManager(testManagerConfig)__ - the constructor method  
    Parameters - a TestManager configuration object with the following properties:
    * serverIP (mandatory) - NV Test Manager IP  
    * serverPort (mandatory) - NV Test Manager port  
    * username (mandatory) - username for authentication  
    * password (mandatory) - password for authentication  
    * useSSL (optional) - Default: __false__
	
* __clone()__ - returns a copy of the existing _TestManager_ object  
	Returns - an _TestManager_ object
	
* __init()__ - initializes the _TestManager_ object with the pre-existing tests, both completed and running  
	Returns - a Promise object

* __stopAllTests()__ - stops all tests that are part of the emulation   
	Returns - a Promise object. The resolve method receives the resulting JSON object, which contains a list of Shunra files (one .shunra file per test), for example:  
	```js
	{
		"analysisResourcesLocation": {
			"073bac1a-48a9-4f70-9c22-df23ff21473db3673d23-f4d4-47c1-817a-b619f7d7b032":
			"C:\\tmp\\TrafficResources\\073bac1a-48a9-4f70-9c22-df23ff21473d\\b3673d23-f4d4-47c1-817ab619f7d7b032\\AnalysisResources.shunra"
		}
	}
	```
* __stopTests(stopTestsParams)__ - stops the specified array of tests   
	Parameters - an object with the following property:
	* tests (mandatory) - an array of tests to stop
	
	Returns - a Promise object. The resolve method receives the resulting JSON object (the same JSON object as in "stopAllTests" method).

* __getTestTokens(getTestTokensParams)__ - gets all running test tokens  
	Parameters - an object with the following property:
	* allUsers (optional) - set to __true__ to return test tokens for all users, not just the user for API authentication. The user for API authentication must have administrator privileges to use this parameter. If not specified, this parameter is set to __false__.  
	
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:
	```js
	{
		"tests": [{
			"userId": "admin",
			"emulationEngine": {
				"IL-Igor-LT.shunra.net": {
					"testTokens": ["fe7aff67-6eef-4c92-b357-80da7becf50937d7cb1d-4a18-42ae-8533-992e4f2945a7"],
					"emulationMode": "SINGLE_USER"
				}
			}
		}]
	}
	```
	
* __startPacketListCapture()__ - starts capturing all packet lists in all running tests  
	Returns - a Promise object

* __stopPacketListCapture()__ - stops capturing all packet lists in all running tests  
	Returns - a Promise object

* __getPacketListInfo()__ - provides packet list information for all packet lists in all running tests  
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:
	```js
	{
		"packetListsInfo": [
			{
				"flowId": "FLOWS_4",
				"plId": "ID_PACKET_LIST_CLIENT_FLOWS_4",
				"captureStatus": "CAPTURING"
			}, 
			{
				"flowId": "FLOWS_5",
				"plId": "ID_PACKET_LIST_CLIENT_FLOWS_5",
				"captureStatus": "CAPTURING"
			}
		],
		"globalCaptureStatus" : "CAPTURING"
	}
	```

* __setActiveAdapter(activeAdapterParams)__ - sets the active adapter used for the emulation. An active adapter determines the NIC through which impairments are applied to the traffic and packets are captured. Only IPV4 is supported.  
	Parameters - an object with the following properties:
	* ip (mandatory) - the active adapter IP
	* reverseDirection (optional) - (Relevant when using "Default Flow") When the packet direction cannot be determined from the packet header,
	NV cannot determine if the packet originated in the client or the server.  
	Possible values:
	  * __false__ (default). The packets are treated as if the NV Driver is installed on the client. All packets arrive from the server endpoint, and all packets exit to the server endpoint.
	  * __true__. The NV driver is considered as if installed on the server. All packets arrive from the client endpoint, and all packets exit to the client endpoint.	  
	
	Returns - a Promise object 

* __getActiveAdapter()__ - gets the active adapter  
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:  
	```js
	{
		"ip": "192.168.0.101",
		"reverseDirection": false
	}
	```

* __setConfiguration(configurationParams)__ - sets the NV configuration  
	Parameters - an object with the following properties:
	* isPacketListCaptureCyclic (optional) - Default: __true__
	* packetListMaxSizeMB (mandatory) - the maximum size of the packet list (comprises all devices in a test)
	* packetListServerClientRatio (optional) - Default: 0 (all packet lists are allocated on the client side)
	
	Returns - a Promise object 

* __getConfiguration()__ - gets the NV configuration  
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example: 
	```js
	{
		"isPacketListCaptureCyclic": true,
		"packetListMaxSizeMB": 100,
		"minNumOfPacketListSpace": 3,
		"captureBytesPerPacket": 1500,
		"packetListServerClientRatio": 0
	}
	```
	
* __analyzeShunraFile(analyzeParams)__ - analyzes the test according to the specified .shunra file  
	Parameters - an object with the following properties:
	* ports (mandatory) - array of ports to be analyzed
	* useJsonFormat (optional) - if set to __true__, the analysis result is returned as a JSON string. Otherwise, an HTML report is returned. Default: __false__
	* zipResultFilePath (optional) - the path of the .zip file that is created if useJsonFormat = __false__. Default: "analysis-result.zip"
	* shunraFilePath (mandatory) - the .shunra file path used for analysis

	Returns - a Promise object. The resolve method receives the resulting JSON string or the path of the .zip file.
	
### Test Module
This module represents a _Test_ instance and includes the following methods:
* __Test(testConfig)__ - the constructor method  
	Parameters - an object with the following properties:
	* testManager (mandatory) - a previously created _TestManager_ object that contains the NV server URL, NV Test Manager port, user credentials, and so on
	* testName (mandatory) - test name
	* description (optional) - test description
	* networkScenario (mandatory) - network scenario name
	* testMode (optional) - a Test.MODE enum. Possible values: Test.MODE.NTX and Test.MODE.CUSTOM. Default: Test.MODE.CUSTOM
	* isMultiUserEmulation (optional) - a Boolean specifying whether to use MULTI_USER or SINGLE_USER emulation. Default: __true__  
	Properties used only in NTX test mode (Test.MODE.NTX):  
	* ntxxFilePath (mandatory for NTX test mode) - the path to the .ntx/.ntxx file containing the client and server IP ranges
	* overrideIp (optional) - Default: __false__. If set to __true__, allows you to override the client IP defined in the .ntx/.ntxx file with the active adapter value. In this case, the .ntx/.ntxx file must be a single flow file and the mode must be SINGLE_USER.  
	Properties used only in custom test mode (Test.MODE.CUSTOM):  
	* flows (optional) - array of flows. Each object in the array must be an instance of class _Flow_. Default: [].
	You can also create the test instance and add flows later by calling the "addFlow" method.    	

	Throws:  
    * NVExceptions.MissingPropertyException - if one of the mandatory properties is missing.	
    * NVExceptions.NotSupportedException - the following are not supported:  
	  a. Unsupported test modes. Supported test modes are: Test.MODE.NTX and Test.MODE.CUSTOM        
	  b. More than one "Default Flow" per test  
	  c. "Default Flow" in MULTI_USER mode  
	  d. MULTI_USER emulation when overrideIp is set to __true__  
      e. Empty source and destination IPs when the list of flows is not empty (only one flow is allowed in that case) 
	  
* __clone()__ - creates a copy of the existing _Test_ object  
	Returns - a _Test_ object
	
* __setUseNVProxy(useNVProxy)__ - sets the "useNVProxy" parameter value. Relevant for analyzing HTTPS traffic. Requires configuration.  
    In NV Test Manager \> Settings tab, configure the NV proxy settings. Then, set the browser's proxy setting to use the IP of your NV Test Manager and the port configured in the proxy settings. For more details, see: http://nvhelp.saas.hpe.com/en/9.10/help/Content/Setup/Setup_environment.htm.  
	Parameters - a Boolean indicating whether to enable NV to capture and decrypt HTTPS traffic in  the test.  

* __addFlow(flow)__ - adds a flow to the array of test flows. Used to add a flow to the test before the "start" method is called.  
	Parameters - a _Flow_ object

	Throws:  	
    * NVExceptions.NotSupportedException - the following are not supported:  
	  a. If the test is currently running  
	  b. More than one "Default Flow" per test  
	  c. "Default Flow" in MULTI_USER mode  
      d. Empty source and destination IPs when the list of flows is not empty (only one flow is allowed in that case)  
    * NVExceptions.MissingPropertyException - an empty source IP is accepted only if the destination IP is also empty. 	  
	
* __start()__ - starts the test based on the properties of the configuration object passed to the _Test_ constructor, for example, the "testMode" (CUSTOM or NTX) property.  
	Returns - a Promise object. The resolve method receives the resulting JSON object that contains the token of the new test, for example:
	```js
	{
		"testToken":"133a1a9e-2885-443f-9ea5-4de373d4a57a372572b2-0d25-4852-91f8-fb849056c89a"
	}
	```
	
* __connectToTransactionManager(connectParams)__ - connects to the transaction manager. You can optionally specify a specific endpoint or packet list to mark the test's transactions for analysis.  
	Parameters - an object with the following properties:
	* plId (optional) - the ID of the packet list from which to connect
	* clientId (optional) - the IP address from which to connect; must be a valid IPv4 address
	* overwriteExistingConnection (optional) - a Boolean flag indicating whether to overwrite an existing connection. Default: __true__
	* flowID (optional) - the ID of a specific flow  
	To connect to all packet lists in the running test, call "connectToTransactionManager" with no parameters.

	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:	
	```js	
	{
		"transactionManagerSessionIdentifier": "Aead518af - 3fa3 - 460c - 9be5 - fc3b6a7101cfB"
	}
	```
	
* __disconnectFromTransactionManager()__ - disconnects from the transaction manager  
	Returns - a Promise object

* __stop()__ - stops the test  
	Returns - a Promise object. The resolve method receives the resulting JSON object (the same JSON object as in the TestManager module's "stopAllTests" method).

* __analyze(analyzeParams)__ - analyzes the test  
	Parameters - an object with the following properties: 
	* ports (mandatory) - array of ports whose traffic is analyzed
	* useJsonFormat (optional) - if set to __true__ the analysis result is returned as a JSON string. Otherwise, an HTML report is returned. Default: __false__
	* zipResultFilePath (optional) - the path of the .zip file that is created if useJsonFormat = __false__. Default: "analysis-result.zip"

	Returns - a Promise object. The resolve method receives the resulting JSON string or the path of the .zip file.
	
* __stopAndAnalyze(stopAndAnalyzeParams)__ - stops and analyzes the test  
	Parameters - an object with the following properties: 
	* ports (mandatory) - array of ports whose traffic is analyzed
	* useJsonFormat (optional) - if set to __true__ the analysis result is returned as a JSON string. Otherwise, an HTML report is returned. Default: __false__
	* zipResultFilePath (optional) - the path of the .zip file that is created if useJsonFormat = __false__. Default: "analysis-result.zip"

	Returns - a Promise object. The resolve method receives the resulting JSON string or the path of the .zip file.
	
* __realTimeUpdate(rtuParams)__ - updates the test in real-time  
	Parameters - an object with the following properties:
	* rtuMode (mandatory) - a Test.RTU_MODE enum. Possible values: Test.RTU_MODE.NTX and Test.RTU_MODE.CUSTOM
	* networkScenario (optional) - the replacement network scenario name
	* description (optional) - the replacement description
	* flows (optional) - the replacement _Flow_ array. Use this property only with the Test.RTU_MODE.CUSTOM real-time update mode.
	* ntxxFilePath (optional) - a path to an .ntx/.ntxx file. You can use the complete .ntx/.ntxx file or only the parts of the file that include the shapes that require updates. Use this property only with Test.RTU_MODE.NTX real-time update mode.
	
	Returns - a Promise object. The resolve method receives the resulting JSON object.

* __getFlowStatistics(flowStatsParams)__ - gets flow statistics  
	Parameters - an object with the following properties:
	* startTime (optional) - used to get statistics from a defined start point. Default: test start time
	* endTime (optional) - used to get statistics until the defined end point. Default: current time
	* flows (optional) - array of flow IDs. If no array is specified, this method gets statistics for all flows.
	
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:	
	```js
	{
		"statistics": [{
			"timeStamp": 1361528862628,
			"flowStats": [{
				"id": "FLOWS_1",
				"clientDownStats": {
					"bps": 480,
					"total": 300,
					"bwUtil": 0
				},
				"clientUpStats": {
					"bps": 480,
					"total": 360,
					"bwUtil": 0
				},
				"serverDownStats": {
					"bps": 480,
					"total": 360,
					"bwUtil": 0
				},
				"serverUpStats": {
					"bps": 480,
					"total": 300,
					"bwUtil": 0
				},
				"cloudStats": {
					"avgLatency": 500,
					"packetLossCount": 0,
					"packetLossPercent": 0,
					"packetLossTotal": 0
				}
			}]
		}]
	}
	```
	
* __getLastStats()__ - gets the data retrieved in the last call to "getFlowStatistics"  
	Returns - the last statistics JSON data retrieved
	
* __getLastStatsTimestamp()__ - gets the value of the response header "x-shunra-next" in the last call to "getFlowStatistics". This header provides the last timestamp for the latest statistics data. You can use this header for future calls to collect statistics data starting from this timestamp.  
	Returns - the last timestamp

* __startPacketListCapture(startPLCaptureParams)__ - starts capturing all of the test's packet lists or the specified packet list  
	Parameters - an object with the following properties:
	* packetListId (optional) - used to capture a specific packet list

	Returns - a Promise object
	
* __stopPacketListCapture(stopPLCaptureParams)__ - stops capturing all of the test's packet lists or the specified packet list.  
	Parameters - an object with the following properties:
	* packetListId (optional) - used to stop capturing a specific packet list

	Returns - a Promise object
	
* __downloadPacketList(downloadPLParams)__ - downloads the specified packet list  
	Parameters - an object with the following properties:
	* packetListId (mandatory) - the packet list ID
	* clear (optional) - clear the packet list after downloading by setting the "clear" flag to __true__. Default: __false__. Use the "clear" flag to save disk space and prevent overwriting packet lists.
	* packetListFilePath (optional) - the path of the packet list file that is created. Default: "packet-list-\<packetListId\>.pcap".

	Returns - a Promise object. The resolve method receives the path of the packet list file.
	
* __getPacketListInfo(getPLInfoParams)__ - gets packet list information from all of the test's packet lists or from a specific packet list.  
	Parameters - an object with the following properties:
	* packetListId (optional) - the packet list ID

	Returns - a Promise object. The resolve method receives the resulting JSON object (the same JSON object as in the TestManager module's "getPacketListInfo" method)
	
* __downloadShunra(downloadShunraParams)__ - downloads a .shunra file containing all of the test's packet lists or a specific packet list (in addition to other files).  
	Parameters - an object with the following properties:
	* packetListId (optional) - the packet list ID (used to get a .shunra file containing a specific packet list)
	* shunraFilePath (optional) - the path of the .shunra file that is created. Default: "shunra-\<testName\>.shunra" or "shunra-\<packetListId\>" (if "packetListId" is specified)

	Returns - a Promise object. The resolve method receives the path of the .shunra file.

### Transaction Module
This module represents a _Transaction_ instance and includes the following methods:
* __Transaction(transactionConfig)__ - the constructor method  
	Parameters - an object with the following properties:
	* name (mandatory) - the transaction name
	* description (optional) - a description of the transaction
	
* __clone()__ - returns a copy of the existing _Transaction_ object  
	Returns - a _Transaction_ object

* __addToTest(test)__ - adds the transaction to the test specified  
	Parameters - a _Test_ object  
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:	
	```js	
	{
	  "id": "9ee4f61e-553b-42f4-b616-f6e55da6c39b",
	  "name": "Search",
	  "description": "",
	  "orderNum": 0,
	  "averageUserTime": 0.0,
	  "averageNetworkTime": 0.0,
	  "runs": {
		
	  }
	}
	```
	
* __start()__ - starts the transaction  	
	Returns - a Promise object. The resolve method receives the resulting JSON object, for example:	
	```js
	{
		"transactionIdentifier": "e16645fa-6f96-4707-b884-fe46b872e3a436434aa6-ae80-4ace-8009-8ee8c970e689",
		"transactionEntity": {
			"id": "e16645fa-6f96-4707-b884-fe46b872e3a4",
			"name": "transaction1",
			"description": "Login transaction",
			"averageUserTime": 0,
			"averageNetworkTime": 0,
			"orderNum": 0,
			"runs": {
				"36434aa6-ae80-4ace-8009-8ee8c970e689": {
					"id": "36434aa6-ae80-4ace-8009-8ee8c970e689",
					"startTime": 1382461475606,
					"endTime": 0,
					"userTime": 0,
					"networkTime": 0,
					"status": "Start",
					"averageBandwith": 0,
					"totalThroughputClient": 0,
					"totalThroughputServer": 0,
					"aggregateScore": 0,
					"numberOfErrors": 0,
					"applicationTurns": 0,
					"protocolOverhead": 0,
					"passed": true
				}
			}
		}
	}
	```

* __stop()__ - stops the transaction  
	Returns - a Promise object

### IPRange Module
This module represents an _IPRange_ instance and includes the following methods:
* __IPRange(ipRangeConfig)__ - the constructor method  
	Parameters - an object with the following properties:
	* from (optional) - Default: 0.0.0.1
	* to (optional) - Default: 255.255.255.255
	* port (optional) - Default: 0
	* protocol (optional) - IPRange.PROTOCOL enum values (see "Enums" section below). Default: IPRange.PROTOCOL.ALL
	
### Range Module
This module represents a _Range_ instance that consists of included and excluded _IPRange_ arrays. It includes the following methods:
* __Range(rangeConfig)__ - the constructor method  
	Parameters - an object with the following properties:
	* include (optional) - array of IP ranges to include
	* exclude (optional) - array of IP ranges to exclude
	
### Flow Module
This module represents a _Flow_ instance and includes the following methods:
* __Flow(flowConfig)__ - the constructor method  
	Parameters - an object with the following properties:
	* flowId (mandatory) - flow ID
	* latency (optional) - Default: 100
	* packetloss (optional) - Default: 0.1
	* bandwidthIn (optional) - Default: 0
	* bandwidthOut (optional) - Default: 0
	* isCaptureClientPL (optional) - Default: __true__
	* isDefaultFlow (optional) - set to __true__ to use "Default Flow". __Note:__ Not supported in MULTI_USER mode. A test can include only one "Default Flow". 
	* shareBandwidth (optional) - set to __false__ to let every Source-Destination IP pair that fits this flow definition use the defined bandwidth. This enables packets to be handled without delay. (When set to __true__, a queue manages the packets, which may result in delayed packet handling.) Default: __true__
	* srcIp (optional) - client IP (source IP)
	* srcIpRange (optional) - client (source) range (an instance of _Range_ class). You can set the source IP range by passing this _Range_ object to the constructor or by calling the "includeSourceIPRange" and/or "excludeSourceIPRange" methods after flow creation.  
	__Note for srcIp and srcIpRange:__ You can use either a source IP or a source IP range. If no values are provided for srcIp and srcIpRange, the source IP takes the IP of the active adapter. 
	* destIp (optional) - server IP (destination IP)
	* destIpRange (optional) - server (destination) range (an instance of _Range_ class). You can set the destination IP range by passing this _Range_ object to the constructor or by calling the "includeDestIPRange" and/or "excludeDestIPRange" methods after flow creation.  
	__Note for destIp and destIpRange:__ You can use either a destination IP or a destination IP range. If no values are provided for destIp and destIpRange, the destination IP range is set to the entire network (0.0.0.1-255.255.255.255), excluding all source IPs in the emulation (to prevent ambiguity). 

	Throws:  
	* NVExceptions.MissingPropertyException - if the flowId is missing.  
	* NVExceptions.NotSupportedException - if the flow is defined as "Default Flow" and the exclude range protocol and port settings are set. 
	
* __includeSourceIPRange(ipRange)__ - adds the specified source IP range to the srcIpRange _Range_ object's "include" array  
	Parameters - an _IPRange_ object
	
* __excludeSourceIPRange(ipRange)__ - removes the specified source IP range from the srcIpRange _Range_ object's "exclude" array   
	Parameters - an _IPRange_ object
				
	Throws:  	
    * NVExceptions.IllegalArgumentException - if the specified argument is not an instance of _IPRange_ class.  
    * NVExceptions.NotSupportedException - if the flow is defined as "Default Flow" and the exclude range protocol and port settings are set.	
	
* __includeDestIPRange(ipRange)__ - adds the specified destination IP range to the destIpRange _Range_ object's "include" array  
	Parameters - an _IPRange_ object
	
* __excludeDestIPRange(ipRange)__ - removes the specified destination IP range from the destIpRange _Range_ object's "exclude" array  
	Parameters - an _IPRange_ object
				
	Throws:  	
    * NVExceptions.IllegalArgumentException - if the specified argument is not an instance of _IPRange_ class.  
    * NVExceptions.NotSupportedException - if the flow is defined as "Default Flow" and the exclude range protocol and port settings are set.	
	
## Enums
* Test mode enum:  

	```js	
	Test.MODE = {
		NTX : "NTX",
		CUSTOM: "Custom"
	};
	```
* Real-time update mode enum:  

	```js	
	Test.RTU_MODE = {
		NTX : "NTX",
		CUSTOM: "Custom"
	};
	```
* IP range protocol enum:  

	```js	
	IPRange.PROTOCOL = {
		ALL : 0,
		ICMP : 1,
		TCP : 6,
		EGP : 8,
		UDP : 17,
		DDP : 37,
		ICMPV6 : 58,
		L2TP : 115
	};
	```
	
## Samples
The hpe-nv-js-samples folder contains both basic and advanced samples that demonstrate the NV API and show common use cases. 
   
To help you get started, each sample has a corresponding batch file with suggested commands. You can run these batch files with the pre-populated commands, or you can run the samples using your own run arguments.  
__Note:__ Minimum recommended Command Prompt (cmd) window size width: 156
  
Some of the samples let you optionally generate a .zip file containing the *NV Analytics* report. You do this by specifying a .zip file path argument.      
   
To view the list of arguments, run: _node \<sample.js\> --help_  
__Example:__ __node basic_analyze_2_scenarios.js --help__

We suggest starting with the basic samples according to the order in the "Basic Step-by-Step Samples" section. These samples walk you step-by-step through the most basic NV methods that you can use in your automated tests. Each subsequent sample demonstrates an additional NV capability. When you finish the basic samples, you can move on to the advanced samples that demonstrate more complex NV methods.  

__Important notes:__  
* Each sample receives an --ssl argument. Make sure to pass __true__ if you are using a secure Test Manager installation.  
* If the website you are testing contains HTTPS traffic, you must use the NV proxy and install an appropriate SSL certificate, as described in http://nvhelp.saas.hpe.com/en/9.10/help/Content/Setup/Setup_environment.htm.

### Basic Step-by-Step Samples
#### basic_nv_test.js
This sample demonstrates the use of the most basic NV methods.

First, the sample creates a _TestManager_ object and initializes it.  

The sample starts an NV test over an emulated �3G Busy� network. ("3G Busy" is one of NV's built-in network profiles. A network profile specifies the network traffic behavior, including latency, packet loss, and incoming/outgoing bandwidth. Network profiles are used to emulate traffic over real-world networks.)  

Next, the sample navigates to the home page in the HPE Network Virtualization website using the Selenium WebDriver.  

Finally, the sample stops the NV test.
 
##### basic_nv_test.js steps:
1. Create a _TestManager_ object and initialize it.
2. Start the NV test with the "3G Busy" network scenario.
3. Build the Selenium WebDriver.
4. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
5. Close and quit the Selenium WebDriver.
6. Stop the NV test.


#### basic_analyze_nv_test.js
This sample demonstrates the use of the most basic NV methods.

First, the sample creates a _TestManager_ object and initializes it.  

The sample starts an NV test over an emulated �3G Busy� network.  

Next, the sample navigates to the home page in the HPE Network Virtualization website using the Selenium WebDriver.  
 
Finally, the sample stops the NV test, analyzes it, and prints the path of the analysis .zip file to the console.

##### basic_analyze_nv_test.js steps:
1. Create a _TestManager_ object and initialize it.
2. Start the NV test with the "3G Busy" network scenario.
3. Build the Selenium WebDriver.
4. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
5. Close and quit the Selenium WebDriver.
6. Stop and analyze the NV test and get the result as a .zip file.
7. Print the path of the .zip file to the console.

 
#### basic_comparison_without_nv.js
This sample demonstrates how NV helps you test your application under various network conditions. 
    
This test starts by navigating to the home page in the HPE Network Virtualization website using the Selenium WebDriver. This initial step runs without NV emulation and provides a basis for comparison.  
    
Next, the sample starts an NV test configured with a "3G Busy" network scenario. The same step runs as before - navigating to the home page in the HPE Network Virtualization website - but this time, it does so over an emulated "3G Busy" network as part of an NV transaction.  
      
When the sample finishes running, it prints a summary to the console. This summary displays a comparison of the time it took to navigate to the site both with and without NV's network emulation. The results show that the slow "3G Busy" network increases the time it takes to navigate to the site, as you would expect.  

##### basic_comparison_without_nv.js steps:
1. Build the Selenium WebDriver.
2. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
3. Close and quit the Selenium WebDriver.
4. Create and initialize the _TestManager_ object.
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


#### basic_analyze_nv_transactions.js
This sample demonstrates how to run transactions as part of an NV test.

In this sample, the NV test starts with the "3G Busy" network scenario, running three transactions (see below).
After the sample stops and analyzes the NV test, it prints the analysis .zip file path to the console.

This sample runs three NV transactions:
1. "Home Page" transaction: Navigates to the home page in the HPE Network Virtualization website.
2. "Get Started" transaction: Navigates to the Get Started Now page in the HPE Network Virtualization website.
3. "Overview" transaction: Navigates back to the home page in the HPE Network Virtualization website.

##### basic_analyze_nv_transactions.js steps:
1. Create a _TestManager_ object and initialize it.
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


#### basic_analyze_2_scenarios.js
This sample demonstrates a comparison between two network scenarios - "WiFi" and "3G Busy". 
  
In this sample, the NV test starts with the "WiFi" network scenario, running three transactions (see below). Then, the sample updates the NV test's network scenario to "3G Busy" using the real-time update API and runs the same transactions again.  
  
After the sample analyzes the NV test and extracts the transaction times from the analysis results, it prints a summary to the console. The summary displays the comparative network times for each transaction in both network scenarios. 

This sample runs three identical NV transactions before and after the real-time update:
1. "Home Page" transaction: Navigates to the home page in the HPE Network Virtualization website.  
2. "Get Started" transaction: Navigates to the Get Started Now page in the HPE Network Virtualization website.  
3. "Overview" transaction: Navigates back to the home page in the HPE Network Virtualization website.  
  
##### basic_analyze_2_scenarios.js steps:
1. Create and initialize the _TestManager_ object.
2. Set the active adapter.
3. Start the NV test with the "WiFi" network scenario.
4. Connect the NV test to the transaction manager.
5. Start the "Home Page" NV transaction.
6. Build the Selenium WebDriver.
7. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
8. Stop the "Home Page" NV transaction.
9. Start the "Get Started" NV transaction.
10. Click the __Get Started Now__ button using the Selenium WebDriver.
11. Stop the "Get Started" NV transaction.
12. Start the "Overview" NV transaction.
13. Click the __Overview__ button using the Selenium WebDriver.
14. Stop the "Overview" NV transaction.
15. Close and quit the Selenium WebDriver.
16. Update the NV test in real time - update the network scenario to "3G Busy".
17. Rerun the transactions (repeat steps 5-11).
18. Stop the NV test.
19. Analyze the NV test and extract the network times for the NV transactions.
20. Print the network time comparison summary to the console.


### Advanced Samples
#### adv_all_test_class_methods.js
This sample demonstrates all of the Test module APIs except for the real-time update API, which is demonstrated in adv_realtime_update.js. You can start the test in this sample using either the NTX or Custom modes.

##### adv_all_test_class_methods.js steps:
1. Create and initialize the _TestManager_ object.
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
17. Analyze the NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
18. Print the NV transaction's network time or the path of the .zip file, if the --zip-result-file-path argument is specified.
19. Download the specified packet list.
20. Download the .shunra file.
21. Close and quit the Selenium WebDriver.


#### adv_realtime_update.js
This sample demonstrates the real-time update API. You can use this API to update the test during runtime. For example, you can update the network scenario to run several "mini tests" in a single test.  
  
This sample starts by running an NV test with a single transaction that uses the "3G Busy" network scenario. Then the sample updates the network scenario to "3G Good" and reruns the transaction. You can update the test in real time using either the NTX or Custom real-time update modes.

##### adv_realtime_update.js steps:
1. Create and initialize the _TestManager_ object.
2. Set the active adapter.
3. Start the NV test with the "3G Busy" network scenario.
4. Connect the NV test to the transaction manager.
5. Start the "Home Page" NV transaction.
6. Build the Selenium WebDriver.
7. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
8. Stop the "Home Page" NV transaction.
9. Close and quit the Selenium WebDriver.
10. Update the NV test in real time - update the network scenario to "3G Good".
11. Rerun the transaction (repeat steps 5-9).
12. Stop the NV test.
13. Analyze the NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
14. Print the NV transactions' network times or the path of the .zip file, if the --zip-result-file-path argument is specified.


#### adv_all_testmanager_class_methods.js
This sample demonstrates all of the TestManager module APIs. These APIs let you:
* initialize the _TestManager_ object to pass logon credentials, the NV Test Manager IP, the port, and so on
* set/get the NV configuration and active adapter
* get the running tests tokens  
* start/stop packet list capture
* get packet list information
* stop a specified array of tests or all of the running tests
* analyze a .shunra file, which is a compressed file that includes an events file, metadata, and packet lists 

##### adv_all_testmanager_class_methods.js steps:
1. Create and initialize the _TestManager_ object.
2. Set the active adapter.
3. Get the active adapter and print its properties to the console (displayed only if the --debug argument is set to true).
4. Set the NV configuration.
5. Get the NV configuration and print its properties to the console (displayed only if the --debug argument is set to true).
6. Start the first NV test with "Flow1" - _view the sample's code to see the flow's properties_.
7. Connect the first NV test to the transaction manager.
8. Start the second NV test with "Flow2" - _view the sample's code to see the flow's properties_.
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
22. Analyze the specified .shunra file and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
23. Print the network times of the transactions in the .shunra file, or the path of the .zip file, if the --zip-result-file-path argument is specified.
24. Close and quit the Selenium WebDriver.


#### adv_multiple_tests_sequential.js
This sample shows how to run several tests sequentially with different network scenarios.
  
##### adv_multiple_tests_sequential.js steps:
1. Create and initialize the _TestManager_ object.
2. Set the active adapter.
3. Start the first NV test with the "3G Busy" network scenario.
4. Connect the first NV test to the transaction manager.
5. Start the "Home Page" NV transaction in the first NV test.
6. Build the Selenium WebDriver.
7. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
8. Stop the "Home Page" NV transaction in the first NV test.
9. Close and quit the Selenium WebDriver.
10. Stop the first NV test.
11. Analyze the first NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
12. Print the NV transaction's network time or the location of the .zip file for the first test, if the --zip-result-file-path argument is specified.
13. Start the second NV test with the "3G Good" network scenario.
14. Connect the second NV test to the transaction manager.
15. Run the same transaction in the second test (repeat steps 5-9).
16. Stop the second NV test.
17. Analyze the second NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
18. Print the NV transaction's network time or the location of the .zip file for the second test, if the --zip-result-file-path argument is specified.


#### adv_multiple_tests_concurrent.js
This sample shows how to run several tests concurrently with different flow definitions. When running NV tests in parallel, make sure that:
* each test is configured to use MULTI_USER mode
* the include/exclude IP ranges in the tests' flows do not overlap - this ensures data separation between the tests
* your NV Test Manager license supports multiple flows running in parallel
  
##### adv_multiple_tests_concurrent.js steps:
1. Create and initialize the _TestManager_ object.
2. Set the active adapter.
3. Start the first NV test with "Flow1" - _view the sample's code to see the flow's properties_.
4. Connect the first NV test to the transaction manager.
5. Start the second NV test with "Flow2" - _view the sample's code to see the flow's properties_.
6. Connect the second NV test to the transaction manager.
7. Start the "Home Page" NV transaction in the first test.
8. Start the "Home Page" NV transaction in the second test.
9. Build the Selenium WebDriver.
10. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
11. Stop the "Home Page" NV transaction in the first test.
12. Stop the "Home Page" NV transaction in the second test.
13. Stop the first NV test.
14. Stop the second NV test.
15. Analyze the first NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
16. Print the NV transaction's network time or the location of the .zip file for the first test, if the --zip-result-file-path argument is specified.
17. Analyze the second NV test and get the result as a JSON string or as a .zip file, if the --zip-result-file-path argument is specified.
18. Print the NV transaction's network time or the location of the .zip file for the second test, if the --zip-result-file-path argument is specified.
19. Close and quit the Selenium WebDriver.


## Debugging
During a run session, the HPE Network Virtualization API Node.js module writes various messages to the __nv.log__ file. This log file is stored in the current directory under the __log__ folder (for example, _hpe-nv-js-samples\basic\log_).  
  
In addition, each sample receives a --debug argument. You can pass __true__ to view debug messages in the console or pass __false__ to hide the debug messages.  

## License
```
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
```