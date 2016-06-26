@echo off

goto license-end
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
:license-end

goto comment
    basic_analyze_2_scenarios.bat description:
    This batch file contains commands that run the basic_analyze_2_scenarios.js sample with different arguments.
      * The first command runs the sample with the analysis result .zip file argument and without displaying debug messages in the console.
      * The second command, which is commented out, runs the sample with the analysis result .zip file argument and displays debug messages in the console.
      * The third command, which is commented out, runs the sample and gets the analysis results as an object. It displays debug messages in the console.
      * The forth command, which is commented out, displays the list of supported arguments for the basic_analyze_2_scenarios.js sample.

    basic_analyze_2_scenarios.js description:
    This sample demonstrates a comparison between two network scenarios---"WiFi" and "3G Busy".

    In this sample, the NV test starts with the "WiFi" network scenario, running three transactions (see below).
    Then, the sample updates the NV test's network scenario to "3G Busy" using the real-time update API and runs the same
    transactions again.

    After the sample analyzes the NV test and extracts the transaction times from the analysis results, it prints a
    summary to the console. The summary displays the comparative network times for each transaction in both
    network scenarios.

    This sample runs three identical NV transactions before and after the real-time update:
    1. "Home Page" transaction: Navigates to the home page in the HPE Network Virtualization website
    2. "Get Started" transaction: Navigates to the Get Started Now page in the HPE Network Virtualization website
    3. "Overview" transaction: Navigates back to the home page in the HPE Network Virtualization website

    basic_analyze_2_scenarios.js steps:
    1. Create and initialize the TestManager object.
    2. Set the active adapter.
    3. Start the NV test with the "WiFi" network scenario.
    4. Connect the NV test to the transaction manager.
    5. Start the "Home Page" NV transaction.
    6. Build the Selenium WebDriver.
    7. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
    8. Stop the "Home Page" NV transaction.
    5. Start the "Get Started" NV transaction.
    6. Click the "Get Started Now" button using the Selenium WebDriver.
    7. Stop the "Get Started" NV transaction.
    8. Start the "Overview" NV transaction.
    9. Click the "Overview" button using the Selenium WebDriver.
    10. Stop the "Overview" NV transaction.
    11. Close and quit the Selenium WebDriver.
    12. Update the NV test in real time - update the network scenario to "3G Busy".
    13. Rerun the transactions (repeat steps 5-11).
    14. Stop the NV test.
    15. Analyze the NV test and extract the network times for the NV transactions.
    16. Print the network time comparison summary to the console.
:comment

REM Run the sample with the analysis result .zip file argument
node basic_analyze_2_scenarios.js --server-ip 0.0.0.0 --server-port 8182 --username MyNVUser --password MyNVPassword --proxy MyProxyHost:MyProxyPort --zip-result-file-path analysis-report-basic.zip

REM Run the sample with the analysis result .zip file argument and debug messages
REM node basic_analyze_2_scenarios.js --server-ip 0.0.0.0 --server-port 8182 --username MyNVUser --password MyNVPassword --proxy MyProxyHost:MyProxyPort --zip-result-file-path analysis-report-basic.zip --debug true

REM Run the sample with the analysis result as an object and with debug messages
REM node basic_analyze_2_scenarios.js --server-ip 0.0.0.0 --server-port 8182 --username MyNVUser --password MyNVPassword --proxy MyProxyHost:MyProxyPort --debug true

REM Run the sample with the --help flag to get the list of supported arguments
REM node basic_analyze_2_scenarios.js --help