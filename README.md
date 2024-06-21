<!-- [![Acurast Banner](.banner.png)](https://acurast.com) -->

<h2 align="center">Acurast CLI</h2>

<p align="center">
  <em>
    Deploy apps on the Acurast Network
  </em>
</p>

<p align="center">
  <a href="https://github.com/acurast/acurast-cli/actions?query=workflow%3AProd+branch%3Amain">
    <img alt="Github Actions Build Status" src="https://img.shields.io/github/actions/workflow/status/acurast/acurast-cli/build.yml?label=Prod&style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@acurast/cli">
    <img alt="npm version" src="https://img.shields.io/npm/v/@acurast/cli.svg?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@acurast/cli">
    <img alt="weekly downloads from npm" src="https://img.shields.io/npm/dw/@acurast/cli.svg?style=flat-square"></a>
  <a href="#badge">
    <img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>
  <a href="https://twitter.com/Acurast">
    <img alt="Follow Acurast on Twitter" src="https://img.shields.io/badge/%40Acurast-9f9f9f?style=flat-square&logo=x&labelColor=555"></a>
</p>

## Intro

The Acurast CLI helps you to deploy apps on the Acurast Network.

## Installation

To install the Acurast CLI, you can use npm:

```bash
npm install -g @acurast/cli
```

## Usage

To use the Acurast CLI, type `acurast` followed by any of the available options or commands.

### Options

- `-v`, `--version` - Output the version number.
- `-h`, `--help` - Display help for command.

### Commands

- `deploy [options] [project]` - Deploy the current project to the Acurast platform.
- `init` - Create an acurast.json file and .env file.
- `open` - Open the Acurast resources in your browser.
- `help [command]` - Display help for command.

## Configuration

### Example Configuration

The acurast.json file is generated by running acurast init. Here is an example configuration:

```json
{
  "projects": {
    "example": {
      "projectName": "example",
      "fileUrl": "dist/bundle.js",
      "network": "canary",
      "onlyAttestedDevices": true,
      "assignmentStrategy": {
        "type": "Single"
      },
      "execution": {
        "type": "onetime",
        "maxExecutionTimeInMs": 10000
      },
      "maxAllowedStartDelayInMs": 10000,
      "usageLimit": {
        "maxMemory": 0,
        "maxNetworkRequests": 0,
        "maxStorage": 0
      },
      "numberOfReplicas": 64,
      "requiredModules": [],
      "minProcessorReputation": 0,
      "maxCostPerExecution": 100000000000,
      "includeEnvironmentVariables": [],
      "processorWhitelist": []
    }
  }
}
```

This is the configuration that is read when `acurast deploy` is called and the app is deployed according to those parameters.

Additionaly, a `.env` file is generated that will hold some of the secrets to deploy the app, and also any environmnet variables that you may want to add to your deployment.

```
ACURAST_MNEMONIC=abandon abandon about ...
ACURAST_IPFS_URL=https://api.pinata.cloud
ACURAST_IPFS_API_KEY=eyJhb...
```

### Configuration Details

#### acurast.json

- `projectName`: The name of the project.
- `fileUrl`: The path to the bundled file, including all dependencies (e.g., `dist/bundle.js`).
- `network`: The network on which the project will be deployed. (e.g. `canary`)
- `onlyAttestedDevices`: A boolean to specify if only attested devices are allowed to run the app.- `assignmentStrategy`: Defines the assignment strategy, which can be:
  - `type`: `AssignmentStrategyVariant.Single`: Assigns one set of processors for a deployment. If instantMatch is provided, specifies processors and maximum allowed start delay:
    - `processor`: Processor address.
    - `maxAllowedStartDelayInMs`: Maximum allowed start delay in milliseconds.
  - `type`: `AssignmentStrategyVariant.Competing`: Assigns a new set of processors for each execution.
- `execution`: Specifies the execution details, which can be:
  - `type`: 'onetime'`: Run the deployment only once.
    - `maxExecutionTimeInMs`: Maximum execution time in milliseconds.
  - `type`: 'interval'`: Multiple executions for the deployment.
    - `intervalInMs`: Interval in milliseconds between each execution start.
    - `numberOfExecutions`: The number of executions.
    - `maxAllowedStartDelayInMs`: Specifies the maximum allowed start delay (relative to the starting time) of the deployment in milliseconds.
- `usageLimit`: The usage limits for the deployment:
  - `maxMemory`: Maximum memory usage in bytes.
  - `maxNetworkRequests`: Maximum number of network requests.
  - `maxStorage`: Maximum storage usage in bytes.
- `numberOfReplicas`: The number of replicas, specifying how many processors will run the deployment in parallel.
- `requiredModules`: Modules that the processor needs to support to run the deployment (e.g., `['DataEncryption']` or `[]`).
- `minProcessorReputation`: The minimum required reputation of the processor.
- `maxCostPerExecution`: The maximum cost per execution in the smallest denomination of cACUs.
- `includeEnvironmentVariables`: An array of environment variables in the .env file that will be passed to the deployment.
- `processorWhitelist`: A whitelist of processors that can be used for the deployment.

#### .env

`ACURAST_MNEMONIC`: The mnemonic used to deploy the app. Make sure the account has some cACU! You can claim some on the [faucet](https://faucet.acurast.com).
`ACURAST_IPFS_URL`: The URL of the IPFS gateway, eg. `https://api.pinata.cloud`.
`ACURAST_IPFS_API_KEY`: The API key to access the IPFS gateway. You can [register here](https://pinata.cloud/) to get an API key.

## Development

To contribute to the development of Acurast CLI, follow these steps:

Clone the repository:

```bash
git clone https://github.com/acurast/acurast-cli.git
```

Navigate to the project directory:

```bash
cd acurast-cli
```

Install the dependencies:

```bash
npm install
```

After making your changes, you can run tests using:

```bash
npm run test
```

To test your changes locally:

```bash
npm run setup
```

After this command, `acurast` will be available globally on your computer.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.
