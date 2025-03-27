import type {
  EnvVar,
  Job,
  JobEnvironmentsEncrypted,
  JobId,
} from './acurast/env/types.js'

export interface AcurastProjectConfig {
  // The name of the project.
  projectName: string

  // The path to the bundled file, including all dependencies (e.g., dist/bundle.js).
  // 3 separate types are accepted:
  // 1. A local file path (single file)
  // 2. A local folder path (folder will be zipped and uploaded)
  // 3. An IPFS hash (ipfs://...)
  fileUrl: string

  // The file that will be started during execution. Defaults to "index.js"
  entrypoint?: string

  // The network on which the project will be deployed.
  network: 'canary'

  // A boolean to specify if only attested devices are allowed to run the app.
  onlyAttestedDevices: boolean

  // The start time of the deployment.
  startAt?:
    | {
        // The deployment will start the specified number of milliseconds from now.
        msFromNow: number
      }
    | {
        // The deployment will start at the specified timestamp.
        timestamp: number | string
      }

  // Defines the assignment strategy.
  assignmentStrategy:
    | {
        // The "single" assignment strategy assigns one set of processors for a deployment. This means that if you deploy your app to run in an interval and has 10 executions, all 10 executions will run on the same set of processors. Use this strategy if you need the processors and keys to stay the same for the lifetime of your deployment.
        type: AssignmentStrategyVariant.Single
        // Specify which processors should be used for the deployment. This will skip the matching process.
        instantMatch?: {
          // Processor address.
          processor: string
          // Specifies the maximum allowed start delay (relative to the starting time) of the deployment in milliseconds.
          maxAllowedStartDelayInMs: number
        }[]
      }
    | {
        // The "single" assignment strategy assigns a new set of processors for each execution of a deployment. This means that if you deploy your app to run in an interval and has 10 executions, each of the 10 executions will run on a different set of processors. Use this strategy if it does not matter which processors are used for the deployment.
        // NOTE: Environment variables are not supported for the "competing" assignment strategy.
        type: AssignmentStrategyVariant.Competing
      }
  // Specifies the execution details.
  execution:
    | {
        // Select the "onetime" type if you want to run the deployment only once.
        type: 'onetime'
        // Specify the maximum execution time for execution in milliseconds. If the script takes longer than that to execute, it will be terminated.
        maxExecutionTimeInMs: number
      }
    | {
        // Select the "interval" type if you want to have multiple executions for the deployment.
        type: 'interval'
        // The interval in milliseconds between each execution start.
        intervalInMs: number
        // The number of executions.
        numberOfExecutions: number
        // The maximum execution time for each execution in milliseconds. This is optional. If not specified, the full duration of the interval will be used.
        maxExecutionTimeInMs?: number
      }
  // Specifies the maximum allowed start delay (relative to the starting time) of the deployment in milliseconds.
  maxAllowedStartDelayInMs: number
  // The usage limits for the deployment.
  usageLimit: {
    // The maximum memory that the deployment can use in bytes.
    maxMemory: number
    // The maximum number of network requests that the deployment can make.
    maxNetworkRequests: number
    // The maximum storage that the deployment can use in bytes.
    maxStorage: number
  }
  // The number of replicas. This specifies how many processors will run the deployment in parallel.
  numberOfReplicas: number
  // Modules that the processor need to support to run the deployment.
  requiredModules?: ['DataEncryption', 'LLM'] | []
  // The minimum required reputation of the processor.
  minProcessorReputation: number
  // The maximum cost per execution in the smallest denomination of cACUs.
  maxCostPerExecution: number
  // An array of environment variables in the .env file that will be passed to the deployment.
  includeEnvironmentVariables?: string[]
  // A whitelist of processors that can be used for the deployment.
  processorWhitelist?: string[]
  // The minimum processor version requirements. If you specify only one platform, the deployment will only be matched with processors of that platform. You can pass a string (e.g., "1.0.0") or a build number (e.g., 10000). Note: If the "human readable" version number is used, it will be converted to the build number. If the CLI isn't up to date, it is possible that the version number is unknown. In this case, use the build number instead.
  minProcessorVersions?: {
    // The minimum version for Android.
    android?: string | number
    // The minimum version for iOS.
    ios?: string | number
  }

  // The restart policy for the deployment. Defaults to "onFailure".
  restartPolicy?: RestartPolicy

  // The runtime of the deployment. Defaults to "NodeJSWithBundle". This setting should only be set if you are using an ipfs hash as the fileUrl and that ipfs hash contains a single js file, not a bundle.
  runtime?: DeploymentRuntime
}

export interface AcurastDeployment {
  deployedAt: string

  assignments: {
    processorId: string
    status: 'matched' | 'acknowledged' | 'failed'
  }[]

  status: 'init' | 'deployed' | 'failed'
  config: AcurastProjectConfig
  registration: JobRegistration
  deploymentId?: JobId

  envInfo?: {
    localPubKey: string
    envEncrypted: JobEnvironmentsEncrypted
  }
}

export interface AcurastCliConfig {
  projects: {
    [projectName: string]: AcurastProjectConfig
  }
}

export enum AssignmentStrategyVariant {
  Single = 'Single',
  Competing = 'Competing',
}

export interface JobRegistration {
  script: string
  allowedSources?: string[]
  allowOnlyVerifiedSources: boolean
  schedule: {
    duration: number
    startTime: number
    endTime: number
    interval: number
    maxStartDelay: number
  }
  memory: number
  networkRequests: number
  storage: number
  requiredModules?: any[]
  extra: {
    requirements: {
      assignmentStrategy: {
        variant: AssignmentStrategyVariant
        instantMatch?: { source: string; startDelay: number }[]
      }
      slots: number
      reward: number
      minReputation?: number
      instantMatch?: { source: string; startDelay: number }[]
      processorVersion?: {
        min: {
          platform: number
          buildNumber: number
        }[]
      }
      runtime: DeploymentRuntime
    }
  }
}

export enum RestartPolicy {
  /**
   * The execution will not be restarted, it will run once and then stop. If it fails, it will not be restarted.
   */
  No = 'no',

  /**
   * The execution will be restarted only if it fails. It will restart 3 times per execution to prevent a crash-loop. If it succeeds, it will not be restarted. NOTE: There will be no failure reports on the first and second failure. Only the third failure will be reported.
   */
  OnFailure = 'onFailure',

  /**
   * The execution will be restarted if it fails or succeeds during the execution window, for a maximum of 3 times per execution. NOTE: There will be no execution reports for the first and second termination. Only the third termination will be reported.
   */
  Always = 'always',
}

export enum DeploymentRuntime {
  NodeJS = 'NodeJS',
  NodeJSWithBundle = 'NodeJSWithBundle',
}
