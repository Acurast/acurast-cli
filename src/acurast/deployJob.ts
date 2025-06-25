import '@polkadot/api-augment'
import { ApiPromise } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types'
import {
  AssignmentStrategyVariant,
  JobRegistration,
  DeploymentError,
} from '../types.js'
import { DeploymentStatus } from './types.js'

export const deployJob = (
  api: ApiPromise,
  injector: KeyringPair,
  job: JobRegistration,
  statusCallback: (
    status: DeploymentStatus,
    data?: JobRegistration | any
  ) => void
): Promise<string> => {
  const script = `0x${Buffer.from(
    new TextEncoder().encode(job.script)
  ).toString('hex')}`
  return new Promise(async (resolve, reject) => {
    const jobRegistration = api.createType('AcurastCommonJobRegistration', {
      script: api.createType('Bytes', script),
      allowedSources: job.allowedSources
        ? api.createType('Option<Vec<AccountId>>', job.allowedSources)
        : api.createType('Option<Vec<AccountId>>', undefined),
      allowOnlyVerifiedSources: job.allowOnlyVerifiedSources,
      schedule: {
        duration: api.createType('u64', job.schedule.duration),
        startTime: api.createType('u64', job.schedule.startTime),
        endTime: api.createType('u64', job.schedule.endTime),
        interval: api.createType('u64', job.schedule.interval),
        maxStartDelay: api.createType('u64', job.schedule.maxStartDelay),
      },
      memory: api.createType('u32', job.memory),
      networkRequests: api.createType('u32', job.networkRequests),
      storage: api.createType('u32', job.storage),
      requiredModules: api.createType(
        'Vec<AcurastCommonJobModule>',
        job.requiredModules ?? []
      ),
      extra: api.createType('PalletAcurastMarketplaceRegistrationExtra', {
        requirements: api.createType(
          'PalletAcurastMarketplaceJobRequirements',
          {
            assignmentStrategy:
              job.extra.requirements.assignmentStrategy.variant ==
              AssignmentStrategyVariant.Single
                ? api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
                    single: job.extra.requirements.assignmentStrategy
                      .instantMatch
                      ? api.createType(
                          'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
                          job.extra.requirements.assignmentStrategy.instantMatch.map(
                            (item) => ({
                              source: api.createType('AccountId', item.source),
                              startDelay: api.createType(
                                'u64',
                                item.startDelay.toFixed()
                              ),
                            })
                          )
                        )
                      : api.createType('Option<bool>', undefined),
                  })
                : api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
                    competing: '',
                  }),
            slots: api.createType('u8', job.extra.requirements.slots),
            reward: api.createType('u128', job.extra.requirements.reward),
            minReputation: job.extra.requirements.minReputation
              ? api.createType(
                  'Option<u128>',
                  job.extra.requirements.minReputation
                )
              : api.createType('Option<u128>', undefined),
            processorVersion: job.extra.requirements.processorVersion
              ? api.createType(
                  'Option<PalletAcurastMarketplaceProcessorVersionRequirements>',
                  job.extra.requirements.processorVersion
                )
              : api.createType(
                  'Option<PalletAcurastMarketplaceProcessorVersionRequirements>',
                  undefined
                ),
            instantMatch: job.extra.requirements.instantMatch
              ? api.createType(
                  'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
                  job.extra.requirements.instantMatch.map((item: any) => ({
                    source: api.createType('AccountId', item.source),
                    startDelay: api.createType('u64', item.startDelay),
                  }))
                )
              : api.createType('Option<bool>', undefined),
            runtime: api.createType(
              'PalletAcurastMarketplaceRuntime',
              job.extra.requirements.runtime
            ),
          }
        ),
        // expectedFulfillmentFee: api.createType(
        //   "u128",
        //   job.extra.expectedFulfillmentFee
        // ),
      }),
    })

    // Create the additional parameters for the deploy extrinsic
    const mutability = api.createType(
      'AcurastCommonScriptMutability',
      job.mutability
    )
    const reuseKeysFrom = job.reuseKeysFrom
      ? api.createType('Option<(AcurastCommonMultiOrigin, u128)>', [
          api.createType('AcurastCommonMultiOrigin', {
            acurast: job.reuseKeysFrom[1],
          }),
          api.createType('u128', job.reuseKeysFrom[2]),
        ])
      : api.createType('Option<(AcurastCommonMultiOrigin, u128)>', undefined)
    const minMetrics = api.createType('Option<Vec<(u8, u128, u128)>>', [])

    try {
      const unsub = await api.tx['acurast']
        ['deploy'](jobRegistration, mutability, reuseKeysFrom, minMetrics)
        .signAndSend(
          injector,
          async ({ status, events, txHash, dispatchError }) => {
            // console.log(
            //   "Transaction status:",
            //   status.type,
            //   status.isFinalized,
            //   status.isInBlock,
            //   status.isBroadcast,
            //   txHash.toHex()
            // );
            const jobRegistrationEvents = events.filter((event) => {
              return (
                event.event.section === 'acurast' &&
                event.event.method === 'JobRegistrationStoredV2'
              )
            })
            const jobIds = jobRegistrationEvents.map((jobRegistrationEvent) => {
              return jobRegistrationEvent.event.data[0]
            })

            // console.log("jobIds", jobIds);
            if (jobIds.length > 0) {
              statusCallback(DeploymentStatus.WaitingForMatch, {
                jobIds: jobIds.map((jobId) => jobId.toJSON()),
              })
              const unsubStoredJobStatus =
                await api.query.acurastMarketplace.storedJobStatus.multi(
                  jobIds,
                  (statuses) => {
                    // console.log("STATUS CB");
                    const stat = api.registry.createType(
                      'Vec<Option<PalletAcurastMarketplaceJobStatus>>',
                      statuses
                    )
                    const result = stat
                      .map((value, index) => {
                        if (value.isSome) {
                          const statusValue = value.unwrap() as any
                          let status = 'Open'
                          if (statusValue.isMatched) {
                            statusCallback(DeploymentStatus.Matched)
                            status = 'Matched'
                          } else if (statusValue.isAssigned) {
                            statusCallback(DeploymentStatus.Acknowledged, {
                              acknowledged: statusValue.asAssigned.toNumber(),
                            })
                            status = JSON.stringify({
                              assigned: statusValue.asAssigned.toNumber(),
                            })
                            unsubStoredJobStatus()
                          }
                          return {
                            id: jobIds[index],
                            status,
                          }
                        }
                        return undefined
                      })
                      .filter((value) => value !== undefined)

                    // console.log("result", result);

                    // console.log(
                    //   "statuses",
                    //   statuses.map((status) => status.toHuman())
                    // );
                  }
                )
            }

            if (status.isInBlock || status.isFinalized) {
              unsub()
            }

            if (dispatchError) {
              if (dispatchError.isModule) {
                // for module errors, we have the section indexed, lookup
                const decoded = api.registry.findMetaError(
                  dispatchError.asModule
                )
                const { docs, name, section } = decoded

                reject(
                  new DeploymentError(
                    `${docs.join(' ')}`,
                    `${section}.${name}`,
                    { section, name, docs }
                  )
                )
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                const error =
                  dispatchError.toHuman() || dispatchError.toString()
                reject(
                  new DeploymentError(error, 'TransactionError', {
                    originalError: error,
                  })
                )
              }
            } else if (status.isInBlock) {
              resolve(txHash.toHex())
            }
          }
        )
    } catch (e) {
      reject(
        new DeploymentError(
          e instanceof Error
            ? e.message
            : 'Unknown error during job deployment',
          'DeploymentError',
          { originalError: e }
        )
      )
    }
  })
}
