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
    basic_analyze_nv_test.bat description:
    This batch file contains commands that run the basic_analyze_nv_test.js sample with different arguments.
      * The first command runs the sample with the analysis result .zip file argument and without displaying debug messages in the console.
      * The second command, which is commented out, runs the sample with the analysis result .zip file argument and displays debug messages in the console.
      * The third command, which is commented out, displays the list of supported arguments for the basic_analyze_nv_test.js sample.

    basic_analyze_nv_test.js description:
    This sample demonstrates the use of the most basic NV methods.

    First, the sample creates a TestManager object and initializes it.
    The sample starts an NV test over an emulated "3G Busy" network.

    Next, the sample navigates to the home page in the HPE Network Virtualization website
    using the Selenium WebDriver.

    Finally, the sample stops the NV test, analyzes it, and prints the path of the analysis .zip file to the console.

    basic_analyze_nv_test.js steps:
    1. Create a TestManager object and initialize it.
    2. Start the NV test with the "3G Busy" network scenario.
    3. Build the Selenium WebDriver.
    4. Navigate to: http://www8.hp.com/us/en/software-solutions/network-virtualization/index.html
    5. Close and quit the Selenium WebDriver.
    6. Stop and analyze the NV test and get the result as a .zip file.
    7. Print the path of the .zip file to the console.
:comment

REM Run the sample with the analysis result .zip file argument
node basic_analyze_nv_test.js --server-ip 0.0.0.0 --server-port 8182 --username MyNVUser --password MyNVPassword --proxy MyProxyHost:MyProxyPort --zip-result-file-path analysis-report-basic.zip

REM Run the sample with the analysis result .zip file argument and debug messages
REM node basic_analyze_nv_test.js --server-ip 0.0.0.0 --server-port 8182 --username MyNVUser --password MyNVPassword --proxy MyProxyHost:MyProxyPort --zip-result-file-path analysis-report-basic.zip --debug true

REM Run the sample with the --help flag to get the list of supported arguments
REM node basic_analyze_nv_test.js --help