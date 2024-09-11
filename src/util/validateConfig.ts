import { z, type ZodIssue } from 'zod'
import {
  AssignmentStrategyVariant,
  type AcurastProjectConfig,
} from '../types.js'

const isAcurastAddress = (val: string) => {
  // TODO: Add address validation
  return true
}
const isNotAcurastAddressMessage: string = 'Invalid Acurast address'

const acurastProjectConfigSchema = z.object({
  projectName: z.string(),
  fileUrl: z.string(),
  network: z.literal('canary'),
  onlyAttestedDevices: z.boolean(),
  startAt: z
    .union([
      z.object({ msFromNow: z.number().min(0) }),
      z.object({
        timestamp: z.union([
          z
            .number()
            .refine(
              (val) => {
                // TODO: What if this throws?
                const date = new Date(val)
                return !isNaN(date.getTime())
              },
              { message: 'Invalid timestamp' }
            )
            .refine(
              (val) => {
                return val >= Date.now()
              },
              { message: 'Timestamp cannot be in the past' }
            ),
          z.string().datetime(),
        ]),
      }),
    ])
    .optional(),
  assignmentStrategy: z.union([
    z.object({
      type: z.literal(AssignmentStrategyVariant.Single),
      instantMatch: z
        .array(
          z.object({
            processor: z
              .string()
              .refine(isAcurastAddress, isNotAcurastAddressMessage),
            maxAllowedStartDelayInMs: z.number().min(0),
          })
        )
        .optional(),
    }),
    z.object({
      type: z.literal(AssignmentStrategyVariant.Competing),
    }),
  ]),
  execution: z.union([
    z
      .object({
        type: z.literal('onetime'),
        maxExecutionTimeInMs: z.number().min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal('interval'),
        intervalInMs: z.number().min(1),
        numberOfExecutions: z.number().min(1),
      })
      .strict(),
  ]),
  maxAllowedStartDelayInMs: z.number().min(0),
  usageLimit: z.object({
    maxMemory: z.number().min(0),
    maxNetworkRequests: z.number().min(0),
    maxStorage: z.number().min(0),
  }),
  numberOfReplicas: z.number().min(1).max(64),
  // requiredModules: z.array(z.literal('DataEncryption')).optional(),
  requiredModules: z
    .union([z.tuple([z.literal('DataEncryption')]), z.tuple([])])
    .optional(),
  minProcessorReputation: z.number().min(0),
  maxCostPerExecution: z.number().min(0),
  includeEnvironmentVariables: z.array(z.string()).optional(),
  processorWhitelist: z
    .array(z.string().refine(isAcurastAddress, isNotAcurastAddressMessage))
    .optional(),
})

const acurastProjectConfigSchemaWithNotes =
  acurastProjectConfigSchema.superRefine((data, context) => {
    if (!data.onlyAttestedDevices) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Note: onlyAttestedDevices is set to false. This means that the deployment will run on all devices, including unattested devices. This is not recommended for production deployments.',
        path: ['onlyAttestedDevices'],
      })
    }
    if (data.startAt) {
      if ('msFromNow' in data.startAt) {
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          !data.assignmentStrategy.instantMatch &&
          data.startAt.msFromNow < 300_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 5 minutes from now. This can lead to the deployment not running.',
            path: ['startAt', 'msFromNow'],
          })
        }
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          data.assignmentStrategy.instantMatch &&
          data.startAt.msFromNow < 120_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 2 minutes from now. Even with an instantMatch provided, this can lead to the deployment not running.',
            path: ['startAt', 'msFromNow'],
          })
        }
      }
      if ('timestamp' in data.startAt) {
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          data.assignmentStrategy.instantMatch &&
          new Date(data.startAt.timestamp).getTime() - Date.now() < 120_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 5 minutes from now. This can lead to the deployment not running.',
            path: ['startAt', 'timestamp'],
          })
        }
      }
    }
    // TODO: Add check for competing strategy and intervals
  })

// Function to validate the JSON data
export const validateConfig = (
  config: unknown
):
  | { success: true; data: AcurastProjectConfig; notes?: ZodIssue[] }
  | { success: false; error: any; notes?: ZodIssue[] } => {
  const result = {
    ...acurastProjectConfigSchema.safeParse(config),
    notes: acurastProjectConfigSchemaWithNotes.safeParse(config).error?.issues,
  }

  return result
}
