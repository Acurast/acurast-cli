import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import {
  Signer,
  SubmittableExtrinsic,
  UnsubscribePromise,
  VoidFn,
} from '@polkadot/api/types'
import { DispatchError } from '@polkadot/types/interfaces'
import { Event } from '@polkadot/types/interfaces/system'
import { KeyringPair } from '@polkadot/keyring/types'
import '@polkadot/api-augment'
import { u32, u64, u128, StorageKey } from '@polkadot/types'
import { Hash } from '@polkadot/types/interfaces/runtime'
import { Codec } from '@polkadot/types/types'
import {
  CUSTOM_TYPES,
  type JobAssignment,
  type JobAssignmentInfo,
  type JobEnvironmentEncrypted,
  type JobEnvironmentsEncrypted,
  type JobId,
} from './types.js'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { RPC } from '../../commands/deploy.js'
import { BigNumber } from 'bignumber.js'

const { v4: uuidv4 } = require('uuid')

export const ACURAST_DECIMALS: number = 12

export type AccountInfo = {
  balance: u128
  nonce: u32
}
// export type OnboardingMessage = {
//   message: string
//   timestamp: { scaleEncoded: string; value: number }
// }
// export type OnboardingQr = {
//   'android.app.extra.PROVISIONING_WIFI_SSID'?: string
//   'android.app.extra.PROVISIONING_WIFI_PASSWORD'?: string
//   'android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE'?: string
//   'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': string
//   'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': string
//   'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': string
//   'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
//     account: string
//     accountType: SignatureType
//     timestamp: string
//     signature: string
//   }
// }
export type HeartbeatInfo = { processor: string; lastSeen: Date | undefined }
export type KeyAttestationStatus = {
  processor: string
  hasKeyAttestation: boolean
}
// export type ReputationInfo = { processor: string; reputation: Reputation }
// export type AdvertisementPricingInfo = {
//   processor: string
//   pricing: AdvertisementPricing
// }
// export type AdvertisementRestrictionInfo = {
//   processor: string
//   restriction: AdvertisementRestriction
// }

// export type VersionInfo = { processor: string; version?: Version }

// export type JobId = [MultiOrigin, number]
// export type JobStatus = 'Open' | 'Matched' | { assigned: number }
// export type JobStatusDetails = {
//   id: JobId
//   status: JobStatus
// }
// export type Job = {
//   id: JobId
//   registration: JobRegistration
// }

// export type JobAssignmentInfo = {
//   id: JobId
//   processor: string
//   assignment: JobAssignment
// }

// export type ProcessorJobInfo = {
//   processor: string
//   jobs: {
//     jobId: JobId
//     assignment: JobAssignment
//   }[]
// }

export type UnsubEvent = () => void
export interface EventSub<T> {
  filter: (event: Event) => boolean
  map: (event: Event) => T
  sub: (data: T) => void
}

const getHumanReadableError = (
  api: ApiPromise,
  dispatchError: DispatchError | undefined
) => {
  if (!dispatchError) {
    return
  }
  if (dispatchError.isModule) {
    // for module errors, we have the section indexed, lookup
    const decoded = api.registry.findMetaError(dispatchError.asModule)
    const { docs, name, section } = decoded

    const message = `${section}.${name}: ${docs.join(' ')}`

    console.log('DispatchError:', message)
    console.log('DispatchError:', dispatchError.toString())

    return message
  } else {
    // Other, CannotLookup, BadOrigin, no extra info
    console.log('DispatchError:', dispatchError.toString())
    return dispatchError.toString()
  }
}

// const MAX_PROCESSOR_UPDATES = 100

export class AcurastService {
  public api?: ApiPromise

  private wsProvider$: ReplaySubject<WsProvider> = new ReplaySubject(1)
  // private keyring = new Keyring({ type: 'sr25519' })
  // private faucetAccount!: KeyringPair

  private connectPromise?: Promise<ApiPromise>

  private eventSubs: Map<string, EventSub<any>> = new Map()
  private unsubEvents?: VoidFn

  constructor() {
    this.wsProvider$.next(new WsProvider(RPC))
    // private readonly accounts: AccountService // private readonly network: NetworkService, // private readonly http: HttpClient,
    // network.currentNetwork$.subscribe((network) => {
    //   this.wsProvider$.next(new WsProvider(network.acurast.wsUrl))
    //   this.api = undefined
    //   this.connectPromise = undefined
    // })
  }

  public async connect(): Promise<ApiPromise> {
    if (this.api !== undefined) {
      return this.api
    }

    if (this.connectPromise !== undefined) {
      return await this.connectPromise
    }

    const provider = await firstValueFrom(this.wsProvider$)

    this.connectPromise = ApiPromise.create({
      provider,
      types: {
        ...CUSTOM_TYPES,
      },
      rpc: {
        marketplace: {
          filterMatchingSources: {
            description: 'Filters possible matches',
            params: [
              {
                name: 'registration',
                type: 'PalletAcurastMarketplacePartialJobRegistration',
              },
              {
                name: 'sources',
                type: 'Vec<AccountId>',
              },
              {
                name: 'consumer',
                type: 'Option<AcurastCommonMultiOrigin<AccountId>>',
              },
              {
                name: 'latest_seen_after',
                type: 'Option<u128>',
              },
            ],
            type: 'Option<Vec<AccountId>>',
          },
        },
      },
    })
    this.api = await this.connectPromise
    this.connectPromise = undefined

    return this.api
  }

  // public async accountInfo(account: string): Promise<AccountInfo> {
  //   const api = await this.connect()
  //   const info = await api.query.system.account(account)
  //   return {
  //     balance: info.data.free,
  //     nonce: info.nonce,
  //   }
  // }

  // public async subscribeAccountInfo(
  //   account: string,
  //   sub: (info: AccountInfo) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return api.query.system.account(account, (info) => {
  //     sub({ balance: info.data.free, nonce: info.nonce })
  //   })
  // }

  // public async managerCounter(account: string): Promise<u64> {
  //   const api = await this.connect()
  //   const counter = api.createType(
  //     'Option<u64>',
  //     await api.query['acurastProcessorManager']['managerCounter'](account)
  //   )
  //   return counter.unwrapOr(api.createType('u64', 0))
  // }

  // public async onboardingMessage(account: string): Promise<OnboardingMessage> {
  //   const api = await this.connect()
  //   const counter = api.createType(
  //     'u64',
  //     (await this.managerCounter(account)).addn(1)
  //   )
  //   const counterBytes = counter.toU8a()
  //   const managerAccount = api.createType('AccountId', account)
  //   const managerAccountBytes = managerAccount.toU8a()
  //   const now = Date.now()
  //   const timestamp = api.createType('u128', now)
  //   const timestampBytes = timestamp.toU8a()
  //   const message = new Uint8Array(
  //     managerAccountBytes.length + timestampBytes.length + counterBytes.length
  //   )
  //   message.set(managerAccountBytes)
  //   message.set(timestampBytes, managerAccount.length)
  //   message.set(
  //     counterBytes,
  //     managerAccountBytes.length + timestampBytes.length
  //   )

  //   return {
  //     message: u8aToHex(message),
  //     timestamp: {
  //       scaleEncoded: timestamp.toString(),
  //       value: now,
  //     },
  //   }
  // }

  // public async onboardingQr(
  //   account: GetAccount<'substrate'>,
  //   signature: string,
  //   timestamp: string,
  //   apkUrl: string | undefined,
  //   wifi: { ssid?: string; password?: string; type: string } | undefined
  // ): Promise<OnboardingQr> {
  //   const network = await firstValueFrom(this.network.currentNetwork$)
  //   const qr: OnboardingQr = {
  //     'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
  //       network.acurast.deviceAdminComponentName,
  //     'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION':
  //       apkUrl ?? network.acurast.apkUrl,
  //     'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM':
  //       network.acurast.apkChecksum,
  //     'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
  //       account: account.address(),
  //       accountType: account.signatureType,
  //       timestamp,
  //       signature,
  //     },
  //   }

  //   if (wifi && wifi.ssid && wifi.password) {
  //     qr['android.app.extra.PROVISIONING_WIFI_SSID'] = `"${wifi.ssid}"`
  //     qr['android.app.extra.PROVISIONING_WIFI_PASSWORD'] = wifi.password
  //     qr['android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE'] =
  //       wifi.type ?? 'WPA'
  //   }

  //   return qr
  // }

  // public async managerIds(account: string): Promise<u128[] | undefined> {
  //   const api = await this.connect()
  //   const tokens = await api.query.uniques.account.entries(account, 0)
  //   if (tokens.length > 0) {
  //     return tokens.map((value) => api.createType('u128', value[0].args[2]))
  //   }
  //   return undefined
  // }

  // public async transferProcessorOwnership(
  //   origin: string,
  //   newOwnerAccount: string
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   const managerIds = await this.managerIds(origin)
  //   if (managerIds === undefined) {
  //     throw Error('Cannot find manager id')
  //   }

  //   const calls = managerIds.map((managerId) =>
  //     api.tx.uniques.transfer(
  //       api.createType('u128', 0),
  //       managerId,
  //       api.createType('MultiAddress', newOwnerAccount)
  //     )
  //   )

  //   return this.signAndSend(api, origin, calls)
  // }

  // public async managedProcessors(account: string): Promise<string[]> {
  //   const api = await this.connect()
  //   const managerIds = await this.managerIds(account)
  //   const processors =
  //     await api.query['acurastProcessorManager']['managedProcessors'].entries(
  //       managerIds
  //     )
  //   return processors.map(([key, _]) => key.args.at(1)!.toString())
  // }

  // public async getAllManagers(): Promise<
  //   { address: string; managerId: number }[]
  // > {
  //   const api = await this.connect()
  //   const tokens = await api.query.uniques.account.entries()
  //   console.log(tokens.length)
  //   return tokens.map(([key, _]) => {
  //     return {
  //       address: key.args[0].toString(),
  //       managerId: key.args[2].toNumber(),
  //     }
  //   })
  // }

  // public async getAllManagerIds(): Promise<
  //   { accountId: string; managerId: number }[]
  // > {
  //   const api = await this.connect()
  //   const managerIdIndexEntries =
  //     await api.query['acurastProcessorManager'][
  //       'processorToManagerIdIndex'
  //     ].entries()
  //   console.log(managerIdIndexEntries.length)
  //   return managerIdIndexEntries.map(([key, value]) => {
  //     return {
  //       accountId: key.args.at(0)!.toString(),
  //       managerId: value.toJSON() as number,
  //     }
  //   })
  // }

  // public async getAllProcessors(): Promise<
  //   { managerId: string; address: string }[]
  // > {
  //   const api = await this.connect()
  //   const processors =
  //     await api.query['acurastProcessorManager']['managedProcessors'].entries()
  //   return processors.map(([key, _]) => ({
  //     managerId: key.args.at(0)!.toString(),
  //     address: key.args.at(1)!.toString(),
  //   }))
  // }

  // public async getAllHeartbeats(): Promise<
  //   { address: string; lastSeen: number }[]
  // > {
  //   const api = await this.connect()
  //   const heartbeats =
  //     await api.query['acurastProcessorManager']['processorHeartbeat'].entries()

  //   return heartbeats.map(([key, value]) => {
  //     const lastSeen = api.createType('Option<u128>', value).unwrap().toNumber()
  //     return {
  //       address: key.args.at(0)!.toString(),
  //       lastSeen: lastSeen,
  //     }
  //   })
  // }

  // public async getAllUpdateInfos(): Promise<
  //   {
  //     accountId: string
  //     updateInfo: { binaryLocation: string; version: Version }
  //   }[]
  // > {
  //   const api = await this.connect()
  //   const updateInfoEntries =
  //     await api.query['acurastProcessorManager'][
  //       'processorUpdateInfo'
  //     ].entries()

  //   return updateInfoEntries.map(([key, value]) => {
  //     const updateInfo = api
  //       .createType('Option<PalletAcurastProcessorManagerUpdateInfo>', value)
  //       .unwrap()
  //     return {
  //       accountId: key.args.at(0)!.toString(),
  //       updateInfo: codecToUpdateInfo(updateInfo),
  //     }
  //   })
  // }

  // public async getAllVersions(): Promise<
  //   { accountId: string; version: Version }[]
  // > {
  //   const api = await this.connect()
  //   const versionEntries =
  //     await api.query['acurastProcessorManager']['processorVersion'].entries()

  //   return versionEntries.map(([key, value]) => {
  //     const version = api
  //       .createType('Option<PalletAcurastProcessorManagerVersion>', value)
  //       .unwrap()
  //     return {
  //       accountId: key.args.at(0)!.toString(),
  //       version: codecToVersion(version),
  //     }
  //   })
  // }

  // public async storedReputation(
  //   processors: string[]
  // ): Promise<ReputationInfo[]> {
  //   const api = await this.connect()
  //   const reputations =
  //     await api.query['acurastMarketplace']['storedReputation'].multi(
  //       processors
  //     )
  //   return processReputations(reputations, processors, api)
  // }

  // public async subscribeStoredReputation(
  //   processors: string[],
  //   sub: (reputation: ReputationInfo[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurastMarketplace']['storedReputation'].multi(
  //     processors,
  //     (reputations) => {
  //       sub(processReputations(reputations, processors, api))
  //     }
  //   )
  // }

  // public async storedAdvertisementPricing(
  //   processor: string
  // ): Promise<AdvertisementPricing> {
  //   const api = await this.connect()
  //   const pricing = api
  //     .createType(
  //       'Option<PalletAcurastMarketplacePricing>',
  //       await api.query['acurastMarketplace']['storedAdvertisementPricing'](
  //         processor
  //       )
  //     )
  //     .unwrap()
  //   return codecToAdvertisementPricing(pricing)
  // }

  // public async executionEnvironment(
  //   jobId: JobId,
  //   processor: string
  // ): Promise<AcurastEnvironment> {
  //   const api = await this.connect()
  //   const environment = api
  //     .createType(
  //       'Option<AcurastCommonEnvironment>',
  //       await api.query['acurast']['executionEnvironment'](jobId, processor)
  //     )
  //     .unwrap()
  //   return codecToAcurastEnvironment(environment)
  // }

  // public async executionEnvironments(
  //   jobId: JobId
  // ): Promise<AcurastEnvironments> {
  //   const api = await this.connect()
  //   const environments =
  //     await api.query['acurast']['executionEnvironment'].entries(jobId)
  //   return environments.map(([key, value]) => {
  //     return {
  //       processor: key.args.at(1)!.toString(),
  //       environment: codecToAcurastEnvironment(
  //         api.createType('Option<AcurastCommonEnvironment>', value).unwrap()
  //       ),
  //     }
  //   })
  // }

  // public async storedAdvertisementRestriction(
  //   processor: string
  // ): Promise<AdvertisementRestriction> {
  //   const api = await this.connect()
  //   const restriction = api
  //     .createType(
  //       'Option<PalletAcurastMarketplaceAdvertisementRestriction>',
  //       await api.query['acurastMarketplace']['storedAdvertisementRestriction'](
  //         processor
  //       )
  //     )
  //     .unwrap()
  //   return codecToAdvertisementRestriction(restriction)
  // }

  // public async heartbeat(processors: string[]): Promise<HeartbeatInfo[]> {
  //   const api = await this.connect()
  //   const heartbeats =
  //     await api.query['acurastProcessorManager']['processorHeartbeat'].multi(
  //       processors
  //     )
  //   return processHeartbeats(heartbeats, processors, api)
  // }

  // public async subscribeHeartbeat(
  //   processors: string[],
  //   sub: (info: HeartbeatInfo[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurastProcessorManager'][
  //     'processorHeartbeat'
  //   ].multi(processors, (heartbeats) => {
  //     sub(processHeartbeats(heartbeats, processors, api))
  //   })
  // }

  // public async subscribeVersion(
  //   processors: string[],
  //   sub: (info: VersionInfo[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurastProcessorManager']['processorVersion'].multi(
  //     processors,
  //     (versions) => {
  //       sub(processVersions(versions, processors, api))
  //     }
  //   )
  // }

  // public async rewardCutPercentage(version: number = 0): Promise<number> {
  //   const api = await this.connect()
  //   const percentage =
  //     await api.query['acurastFeeManager']['feePercentage'](version)
  //   const value = percentage.toString()
  //   return Number(value)
  // }

  // public async fundAccount(
  //   account: string,
  //   amount: number = 1000000000000000
  // ): Promise<Hash> {
  //   const api = await this.connect()

  //   return this.signAndSend(api, this.faucetAccount, [
  //     api.tx.balances.transfer(account, amount),
  //   ])
  // }

  // public async keyAttestationStatus(
  //   processors: string[]
  // ): Promise<KeyAttestationStatus[]> {
  //   const api = await this.connect()
  //   const attestations =
  //     await api.query['acurast']['storedAttestation'].multi(processors)
  //   return processKeyAttestations(attestations, processors, api)
  // }

  // public async subscribeKeyAttestationStatus(
  //   processors: string[],
  //   sub: (attestations: KeyAttestationStatus[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurast']['storedAttestation'].multi(
  //     processors,
  //     (attestations) => {
  //       sub(processKeyAttestations(attestations, processors, api))
  //     }
  //   )
  // }

  // public async registeredJobs(multiOrigin: MultiOrigin): Promise<Job[]> {
  //   const api = await this.connect()
  //   const jobEntries =
  //     await api.query['acurast']['storedJobRegistration'].entries(multiOrigin)
  //   return jobEntries.map(([key, value]) => {
  //     const id = api.createType('u128', key.args.at(1)!)
  //     const job = api
  //       .createType('Option<AcurastCommonJobRegistration>', value)
  //       .unwrap()
  //     return {
  //       id: [multiOrigin, id.toNumber()],
  //       registration: this.codecToJobRegistration(job),
  //     }
  //   })
  // }
  // public async getAllJobs(): Promise<Job[]> {
  //   const api = await this.connect()
  //   console.log('getAllJobs')
  //   const jobEntries =
  //     await api.query['acurast']['storedJobRegistration'].entries()
  //   console.log(jobEntries)
  //   return jobEntries.map(([key, value]) => {
  //     const origin = api.createType('AcurastCommonMultiOrigin', key.args.at(0)!)
  //     const id = api.createType('u128', key.args.at(1)!)
  //     const job = api
  //       .createType('Option<AcurastCommonJobRegistration>', value)
  //       .unwrap()
  //     return {
  //       id: [this.codecToMultiOrigin(origin), id.toNumber()],
  //       registration: this.codecToJobRegistration(job),
  //     }
  //   })
  // }

  // public async registeredJob(jobId: JobId): Promise<JobRegistration> {
  //   const api = await this.connect()
  //   const jobRegistrationCodec = (
  //     (await api.query['acurast']['storedJobRegistration'](
  //       api.createType('AcurastCommonMultiOrigin', jobId[0]),
  //       jobId[1]
  //     )) as any
  //   ).unwrapOr(undefined)
  //   if (jobRegistrationCodec === undefined) {
  //     throw Error('Cannot fetch job')
  //   }
  //   return this.codecToJobRegistration(jobRegistrationCodec)
  // }

  // public async subscribeToRegisteredJobs(
  //   multiOrigin: MultiOrigin,
  //   sub: (job: Job[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return (await api.query['acurast']['storedJobRegistration'].entries(
  //     multiOrigin,
  //     (jobEntries: [StorageKey<AnyTuple>, Codec][]) => {
  //       const jobs = jobEntries.map(([key, value]) => {
  //         const id = api.createType('u128', key.args.at(1)!)
  //         const job = api
  //           .createType('Option<AcurastCommonJobRegistration>', value)
  //           .unwrap()
  //         return {
  //           id: [multiOrigin, id.toNumber()],
  //           registration: this.codecToJobRegistration(job),
  //         }
  //       })
  //       sub(jobs as Job[])
  //     }
  //   )) as any as UnsubscribePromise
  // }

  public async subscribeToEvent<T>(eventSub: EventSub<T>): Promise<UnsubEvent> {
    const subId: string = uuidv4()
    this.eventSubs.set(subId, eventSub)
    if (this.unsubEvents === undefined) {
      const api = await this.connect()
      this.unsubEvents = await api.query.system.events((events) => {
        const subs = Array.from(this.eventSubs.values())
        events.forEach((record) => {
          const { event } = record
          for (const sub of subs) {
            if (sub.filter(event)) {
              sub.sub(sub.map(event))
            }
          }
        })
      })
    }
    return () => {
      this.eventSubs.delete(subId)
      if (this.eventSubs.size === 0 && this.unsubEvents !== undefined) {
        this.unsubEvents()
        this.unsubEvents = undefined
      }
    }
  }

  // public async subscribeToJobRegistrationStored(
  //   sub: (jobRegistrationStored: [JobRegistration, JobId]) => void
  // ): Promise<UnsubEvent> {
  //   const eventSub: EventSub<[JobRegistration, JobId]> = {
  //     filter: (event) =>
  //       event.section === 'acurast' && event.method === 'JobRegistrationStored',
  //     map: (event) => {
  //       const jobRegistration = this.codecToJobRegistration(event.data.at(0)!)
  //       const jobIdJSON = event.data.at(1)!.toJSON() as any
  //       const jobId: JobId = [
  //         jobIdJSON[0].acurast
  //           ? {
  //               Acurast: jobIdJSON[0].acurast,
  //             }
  //           : {
  //               Tezos: jobIdJSON[0].tezos,
  //             },
  //         jobIdJSON[1],
  //       ]
  //       return [jobRegistration, jobId] as [JobRegistration, JobId]
  //     },
  //     sub,
  //   }
  //   return await this.subscribeToEvent(eventSub)
  // }

  public async subscribeToJobAssignmentEvents(
    sub: (assignment: JobAssignmentInfo) => void
  ): Promise<UnsubEvent> {
    const eventSub: EventSub<JobAssignmentInfo> = {
      filter: (event) =>
        event.section === 'acurastMarketplace' &&
        event.method === 'JobRegistrationAssigned',
      map: (event) => ({
        id: this.codectToJobId(event.data.at(0)!),
        processor: event.data.at(1)!.toString(),
        assignment: this.codecToJobAssignment(event.data.at(2)!),
      }),
      sub,
    }
    return await this.subscribeToEvent(eventSub)
  }

  // public async subscribeToReportedEvents(
  //   sub: (assignment: JobAssignmentInfo) => void
  // ): Promise<UnsubEvent> {
  //   const eventSub: EventSub<JobAssignmentInfo> = {
  //     filter: (event) =>
  //       event.section === 'acurastMarketplace' && event.method === 'Reported',
  //     map: (event) => ({
  //       id: this.codectToJobId(event.data.at(0)!),
  //       processor: event.data.at(1)!.toString(),
  //       assignment: this.codecToJobAssignment(event.data.at(2)!),
  //     }),
  //     sub,
  //   }
  //   return await this.subscribeToEvent(eventSub)
  // }

  // public async waitForNextBlocks(
  //   n: number,
  //   callback: () => void
  // ): Promise<void> {
  //   const api = await this.connect()
  //   let blockToWaitFor = n
  //   const unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(
  //     (_header) => {
  //       --blockToWaitFor
  //       if (blockToWaitFor <= 0) {
  //         unsubscribe()
  //         callback()
  //       }
  //     }
  //   )
  // }

  // public async subscribeJobStatus(
  //   jobIds: JobId[],
  //   sub: (jobStatuses: JobStatusDetails[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurastMarketplace']['storedJobStatus'].multi(
  //     jobIds,
  //     (statuses) => {
  //       const stat = api.registry.createType(
  //         'Vec<Option<PalletAcurastMarketplaceJobStatus>>',
  //         statuses
  //       )
  //       const result = stat
  //         .map((value, index) => {
  //           if (value.isSome) {
  //             const statusValue = value.unwrap() as any
  //             let status: JobStatus = 'Open'
  //             if (statusValue.isMatched) {
  //               status = 'Matched'
  //             } else if (statusValue.isAssigned) {
  //               status = { assigned: statusValue.asAssigned.toNumber() }
  //             }
  //             return {
  //               id: jobIds[index],
  //               status,
  //             }
  //           }
  //           return undefined
  //         })
  //         .filter((value) => value !== undefined)
  //       sub(result as JobStatusDetails[])
  //     }
  //   )
  // }

  public async assignedProcessors(
    jobIds: JobId[]
  ): Promise<Map<string, [JobId, string[]]>> {
    const api = await this.connect()
    const result = new Map<string, [JobId, string[]]>()
    const assignedProcessors = (
      await Promise.all(
        jobIds.map((jobId) =>
          api.query['acurastMarketplace']['assignedProcessors'].entries(jobId)
        )
      )
    ).flat()
    assignedProcessors.forEach(([key, _]) => {
      const jobIdJSON: any = key.args[0].toJSON()
      const jobId: JobId = [
        jobIdJSON[0].acurast
          ? {
              Acurast: jobIdJSON[0].acurast,
            }
          : {
              Tezos: jobIdJSON[0].tezos,
            },
        jobIdJSON[1],
      ]
      const processor = api.createType('AccountId', key.args[1])
      const mapKey = this.jobIdToString(jobId)
      const processors = result.get(mapKey)?.[1] ?? []
      processors.push(processor.toString())
      result.set(mapKey, [jobId, processors])
    })
    return result
  }

  public jobIdToString(jobId: JobId): string {
    if (jobId[0].Acurast) {
      return `Acurast#${jobId[1]}`
    }
    return `Tezos#${jobId[1]}`
  }

  // public async subscribeJobAssignment(
  //   keys: [string, JobId][],
  //   sub: (assignments: JobAssignmentInfo[]) => void
  // ): UnsubscribePromise {
  //   const api = await this.connect()
  //   return await api.query['acurastMarketplace']['storedMatches'].multi(
  //     keys,
  //     (assignments) => {
  //       const values = api.registry.createType(
  //         'Vec<Option<PalletAcurastMarketplaceAssignment>>',
  //         assignments
  //       )
  //       const result: (JobAssignmentInfo | undefined)[] = values
  //         .map((value, index) => {
  //           if (value.isSome) {
  //             const assignment = value.unwrap()
  //             return {
  //               id: keys[index][1],
  //               processor: keys[index][0],
  //               assignment: this.codecToJobAssignment(assignment),
  //             }
  //           }
  //           return undefined
  //         })
  //         .filter((value) => value !== undefined)
  //       sub(result as JobAssignmentInfo[])
  //     }
  //   )
  // }

  public async jobAssignments(
    keys: [string, JobId][]
  ): Promise<JobAssignmentInfo[]> {
    const api = await this.connect()
    const assignments =
      await api.query['acurastMarketplace']['storedMatches'].multi(keys)
    const values = api.registry.createType(
      'Vec<Option<PalletAcurastMarketplaceAssignment>>',
      assignments
    )
    const result: (JobAssignmentInfo | undefined)[] = values
      .map((value, index) => {
        if (value.isSome) {
          const assignment = value.unwrap()
          return {
            id: keys[index][1],
            processor: keys[index][0],
            assignment: this.codecToJobAssignment(assignment),
          }
        }
        return undefined
      })
      .filter((value) => value !== undefined)
    return result as JobAssignmentInfo[]
  }

  // public async subscribeToProcessorJobs(
  //   processors: string[] = []
  // ): Promise<ProcessorJobInfo[]> {
  //   // TODO: Make reactive
  //   const api = await this.connect()

  //   return await Promise.all(
  //     processors.map(async (processor) => ({
  //       processor,
  //       jobs: await api.query['acurastMarketplace']['storedMatches']
  //         .entries(processor)
  //         .then((el) => {
  //           return el.map(([encodedKey, encodedValue]) => {
  //             const key: [string, JobId] = encodedKey.toHuman() as any
  //             const decodedValue = api.registry.createType(
  //               'Option<PalletAcurastMarketplaceAssignment>',
  //               encodedValue
  //             )
  //             const value = this.codecToJobAssignment(decodedValue.unwrap())
  //             return { jobId: key[1], assignment: value }
  //           })
  //         }),
  //     }))
  //   )
  // }

  private jobEnvironmentToCodec(
    api: ApiPromise,
    jobEnvironment: JobEnvironmentEncrypted
  ): Codec {
    const publicKey = `0x${jobEnvironment.publicKey}`
    const variables = jobEnvironment.variables.map((variable) => {
      const key = `0x${Buffer.from(variable.key).toString('hex')}`
      const value = `0x${variable.encryptedValue.iv}${variable.encryptedValue.ciphertext}${variable.encryptedValue.authTag}`
      return [key, value]
    })

    return api.createType('AcurastCommonEnvironment', {
      publicKey: api.createType('Bytes', publicKey),
      variables: api.createType('Vec<(Bytes, Bytes)>', variables),
    })
  }

  public async setEnvironment(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironment: JobEnvironmentEncrypted
  ): Promise<Hash> {
    const api = await this.connect()
    const acurastJobEnvironment = this.jobEnvironmentToCodec(
      api,
      jobEnvironment
    )
    return this.signAndSend(api, keyring, [
      api.tx['acurast']['setEnvironment'](
        jobId,
        keyring.address,
        acurastJobEnvironment
      ),
    ])
  }

  public async setEnvironments(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironments: JobEnvironmentsEncrypted
  ): Promise<Hash> {
    const api = await this.connect()
    const acurastJobEnvironments = jobEnvironments.map((x) => [
      x.processor,
      this.jobEnvironmentToCodec(api, x.jobEnvironment),
    ])

    return this.signAndSend(api, keyring, [
      api.tx['acurast']['setEnvironments'](jobId, acurastJobEnvironments),
    ])
  }

  // public async getLatestProcessorVersion(): Promise<Version | undefined> {
  //   const api = await this.connect()
  //   const response =
  //     await api.query['acurastProcessorManager']['knownBinaryHash'].entries()

  //   if (response.length === 0) {
  //     throw new Error('No versions available')
  //   }

  //   let selectedVersion: Version | undefined

  //   response.forEach((element) => {
  //     const codec = element[0].args.at(0)

  //     if (!codec) {
  //       throw new Error('Invalid version encoding')
  //     }

  //     const versionInfo = codecToVersion(codec)

  //     const platformVersions = deviceVersions.get(versionInfo.platform)

  //     const version = platformVersions?.get(versionInfo.buildNumber)

  //     if (
  //       version &&
  //       (!selectedVersion ||
  //         selectedVersion.buildNumber < versionInfo.buildNumber)
  //     ) {
  //       selectedVersion = versionInfo
  //     } else {
  //       console.warn('Ignoring version ', versionInfo)
  //     }
  //   })

  //   return selectedVersion
  // }

  // public async updateProcessors(
  //   origin: string,
  //   processors: string[],
  //   version: Version
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   const network = await firstValueFrom(this.network.currentNetwork$)

  //   const chunks: string[][] = []
  //   for (let i = 0; i < processors.length; i += MAX_PROCESSOR_UPDATES) {
  //     const chunk = processors.slice(i, i + MAX_PROCESSOR_UPDATES)
  //     chunks.push(chunk)
  //   }
  //   const calls = chunks.map((processors) => {
  //     return api.tx['acurastProcessorManager']['setProcessorUpdateInfo'](
  //       {
  //         version,
  //         binaryLocation: network.acurast.apkUrl,
  //       },
  //       processors
  //     )
  //   })
  //   return this.signAndSend(api, origin, calls)
  // }

  // public async removePairedProcessor(
  //   origin: string,
  //   processor: string
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   return this.signAndSend(api, origin, [
  //     api.tx['acurastProcessorManager']['updateProcessorPairings']([
  //       {
  //         operation: api.createType(
  //           'AcurastCommonListUpdateOperation',
  //           'Remove'
  //         ),
  //         item: api.createType('AccountId', processor),
  //         proof: api.createType(
  //           'Option<PalletAcurastProcessorManagerProof>',
  //           undefined
  //         ),
  //       },
  //     ]),
  //   ])
  // }

  // public async registerJob(
  //   origin: string,
  //   job: JobRegistration
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   const jobRegistration = this.jobRegistrationToCodec(api, job)
  //   return this.signAndSend(api, origin, [
  //     api.tx['acurast']['register'](jobRegistration),
  //   ])
  // }

  // public async deregisterJob(
  //   origin: string,
  //   localJobId: number
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   return this.signAndSend(api, origin, [
  //     api.tx['acurast']['deregister'](localJobId),
  //   ])
  // }

  // public async finalizeJobs(origin: string, jobIds: JobId[]): Promise<Hash> {
  //   const api = await this.connect()
  //   return this.signAndSend(api, origin, [
  //     api.tx['acurastMarketplace']['finalizeJobs'](
  //       jobIds.filter((id) => id[0].Acurast !== undefined).map((id) => id[1])
  //     ),
  //   ])
  // }

  // public async advertiseFor(
  //   origin: string,
  //   processor: string,
  //   advertisement: Advertisement
  // ): Promise<Hash> {
  //   const api = await this.connect()
  //   const advertisementCodec = this.advertisementToCodec(api, advertisement)
  //   return this.signAndSend(api, origin, [
  //     api.tx['acurastProcessorManager']['advertiseFor'](
  //       processor,
  //       advertisementCodec
  //     ),
  //   ])
  // }

  // public async filterMatchingSources(
  //   job: PartialJobRegistration,
  //   processors: string[],
  //   consumer?: string,
  //   latestSeenAfter?: Date
  // ): Promise<string[]> {
  //   const network = await firstValueFrom(this.network.currentNetwork$)
  //   const response: any = await firstValueFrom(
  //     this.http.post(network.acurast.httpUrl, {
  //       id: 1,
  //       jsonrpc: '2.0',
  //       method: 'filterMatchingSources',
  //       params: [
  //         this.partialJobRegistrationToJSON(job),
  //         processors,
  //         consumer ?? null,
  //         latestSeenAfter?.getTime() ?? null,
  //       ],
  //     })
  //   )
  //   return response.result ?? []
  // }

  // public async properties(): Promise<{
  //   symbol: string | undefined
  //   decimals: number | undefined
  // }> {
  //   const api = await this.connect()
  //   const result = await api.rpc.system.properties()
  //   const symbol = result.tokenSymbol.unwrapOrDefault().at(0)?.toString()
  //   const decimals = result.tokenDecimals.unwrapOrDefault().at(0)?.toNumber()
  //   return {
  //     symbol,
  //     decimals,
  //   }
  // }

  // private codecToMultiOrigin(codec: Codec): MultiOrigin {
  //   const multiOriginJSON = codec.toJSON() as any
  //   return multiOriginJSON.acurast
  //     ? {
  //         Acurast: multiOriginJSON.acurast,
  //       }
  //     : {
  //         Tezos: multiOriginJSON.tezos,
  //       }
  // }

  private async signAndSend(
    api: ApiPromise,
    keyring: KeyringPair,
    calls: SubmittableExtrinsic<'promise', any>[]
  ): Promise<Hash> {
    let call: SubmittableExtrinsic<'promise', any>
    if (calls.length > 1) {
      call = api.tx.utility.batch(calls)
    } else {
      call = calls[0]
    }

    return new Promise(async (resolve, reject) => {
      const unsub = await call
        .signAndSend(keyring, ({ status, events, dispatchError }) => {
          if (dispatchError) {
            const humanReadableError = getHumanReadableError(api, dispatchError)

            if (unsub) {
              unsub()
            }
            reject(new Error(humanReadableError))
            return
          }
          if (status.isInBlock) {
            if (unsub) {
              unsub()
            }
            resolve(status.hash)
            return
          }
        })
        .catch(reject)
    })
  }

  private codectToJobId(codec: Codec): JobId {
    const jobIdJSON = codec.toJSON() as any
    return [
      jobIdJSON[0].acurast
        ? {
            Acurast: jobIdJSON[0].acurast,
          }
        : {
            Tezos: jobIdJSON[0].tezos,
          },
      jobIdJSON[1],
    ]
  }

  // private advertisementToCodec(
  //   api: ApiPromise,
  //   advertisement: Advertisement
  // ): Codec {
  //   return api.createType('PalletAcurastMarketplaceAdvertisement', {
  //     pricing: {
  //       feePerMillisecond: api.createType(
  //         'u128',
  //         advertisement.pricing.feePerMillisecond.toFixed()
  //       ),
  //       feePerStorageByte: api.createType(
  //         'u128',
  //         advertisement.pricing.feePerStorageByte.toFixed()
  //       ),
  //       baseFeePerExecution: api.createType(
  //         'u128',
  //         advertisement.pricing.baseFeePerExecution.toFixed()
  //       ),
  //       schedulingWindow: {
  //         end: api.createType(
  //           'u64',
  //           advertisement.pricing.schedulingWindow.end.getTime()
  //         ),
  //       },
  //     },
  //     maxMemory: api.createType('u32', advertisement.maxMemory),
  //     networkRequestQuota: api.createType(
  //       'u8',
  //       advertisement.networkRequestQuota
  //     ),
  //     storageCapacity: api.createType('u32', advertisement.storageCapacity),
  //     allowedConsumers: api.createType(
  //       'Option<Vec<AcurastCommonMultiOrigin>>',
  //       advertisement.allowedConsumers
  //     ),
  //     availableModules: api.createType(
  //       'Vec<AcurastCommonJobModule>',
  //       advertisement.availableModules
  //     ),
  //   })
  // }

  // private jobRegistrationToCodec(api: ApiPromise, job: JobRegistration): Codec {
  //   const script = `0x${Buffer.from(new TextEncoder().encode(job.script)).toString('hex')}`
  //   return api.createType('AcurastCommonJobRegistration', {
  //     script: api.createType('Bytes', script),
  //     allowedSources: job.allowedSources
  //       ? api.createType('Option<Vec<AccountId>>', job.allowedSources)
  //       : api.createType('Option<Vec<AccountId>>', undefined),
  //     allowOnlyVerifiedSources: job.allowOnlyVerifiedSources,
  //     schedule: {
  //       duration: api.createType('u64', job.schedule.duration),
  //       startTime: api.createType('u64', job.schedule.startTime.getTime()),
  //       endTime: api.createType('u64', job.schedule.endTime.getTime()),
  //       interval: api.createType('u64', job.schedule.interval.toFixed()),
  //       maxStartDelay: api.createType('u64', job.schedule.maxStartDelay),
  //     },
  //     memory: api.createType('u32', job.memory),
  //     networkRequests: api.createType('u32', job.networkRequests),
  //     storage: api.createType('u32', job.storage),
  //     requiredModules: api.createType(
  //       'Vec<AcurastCommonJobModule>',
  //       job.requiredModules ?? []
  //     ),
  //     extra: api.createType('PalletAcurastMarketplaceRegistrationExtra', {
  //       requirements: api.createType(
  //         'PalletAcurastMarketplaceJobRequirements',
  //         {
  //           assignmentStrategy:
  //             job.extra.requirements.assignmentStrategy.variant ==
  //             AssignmentStrategyVariant.Single
  //               ? api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
  //                   single: job.extra.requirements.assignmentStrategy
  //                     .instantMatch
  //                     ? api.createType(
  //                         'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
  //                         job.extra.requirements.assignmentStrategy.instantMatch.map(
  //                           (item) => ({
  //                             source: api.createType('AccountId', item.source),
  //                             startDelay: api.createType(
  //                               'u64',
  //                               item.startDelay.toFixed()
  //                             ),
  //                           })
  //                         )
  //                       )
  //                     : api.createType('Option<bool>', undefined),
  //                 })
  //               : api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
  //                   competing: '',
  //                 }),
  //           slots: api.createType('u8', job.extra.requirements.slots),
  //           reward: api.createType(
  //             'u128',
  //             job.extra.requirements.reward.toFixed()
  //           ),
  //           minReputation: job.extra.requirements.minReputation
  //             ? api.createType(
  //                 'Option<u128>',
  //                 job.extra.requirements.minReputation.toFixed()
  //               )
  //             : api.createType('Option<u128>', undefined),
  //         }
  //       ),
  //     }),
  //   })
  // }

  // private codecToJobRegistration(codec: Codec): JobRegistration {
  //   const data = codec as any
  //   return {
  //     script: new TextDecoder().decode(
  //       Buffer.from(data.script.toHex().slice(2), 'hex')
  //     ),
  //     allowedSources: data.allowedSources.unwrapOr(undefined)?.toJSON(),
  //     allowOnlyVerifiedSources: data.allowOnlyVerifiedSources.toJSON(),
  //     schedule: {
  //       duration: data.schedule.duration.toNumber(),
  //       startTime: new Date(data.schedule.startTime.toNumber()),
  //       endTime: new Date(data.schedule.endTime.toNumber()),
  //       interval: new BigNumber(data.schedule.interval.toBigInt()),
  //       maxStartDelay: data.schedule.maxStartDelay.toNumber(),
  //     },
  //     memory: data.memory.toNumber(),
  //     networkRequests: data.networkRequests.toNumber(),
  //     storage: data.storage.toNumber(),
  //     requiredModules: data.requiredModules.toJSON() ?? undefined,
  //     extra: {
  //       requirements: {
  //         assignmentStrategy: this.codecToAssignmentStrategy(
  //           data.extra.requirements.assignmentStrategy
  //         ),
  //         slots: data.extra.requirements.slots.toNumber(),
  //         reward: new BigNumber(data.extra.requirements.reward.toBigInt()),
  //         minReputation: (() => {
  //           const rep = data.extra.requirements.minReputation
  //             .unwrapOr(undefined)
  //             ?.toBigInt()
  //           if (rep) {
  //             return new BigNumber(rep)
  //           }
  //           return undefined
  //         })(),
  //       },
  //     },
  //   }
  // }

  // private codecToAssignmentStrategy(codec: Codec): AssignmentStrategy {
  //   const data = codec as any
  //   if (data.isSingle) {
  //     return {
  //       variant: AssignmentStrategyVariant.Single,
  //       instantMatch: data.asSingle.toJSON()?.map((value: any) => ({
  //         source: value.source,
  //         startDelay: new BigNumber(value.startDelay),
  //       })),
  //     }
  //   } else if (data.isCompeting) {
  //     return { variant: AssignmentStrategyVariant.Competing }
  //   }

  //   throw new Error(
  //     `unsupported AssignmentStrategy variant: ${codec.toString()}`
  //   )
  // }

  private codecToJobAssignment(codec: Codec): JobAssignment {
    const json = codec.toJSON() as any
    return {
      slot: json.slot,
      startDelay: json.startDelay,
      feePerExecution: new BigNumber(json.feePerExecution),
      acknowledged: json.acknowledged,
      sla: {
        total: new BigNumber(json.sla.total),
        met: new BigNumber(json.sla.met),
      },
      pubKeys: json.pubKeys.map((value: any) => ({
        SECP256r1: value.secp256r1,
        SECP256k1: value.secp256k1,
        ED25519: value.ed25519,
        SECP256r1Encryption: value.secp256r1Encryption,
        SECP256k1Encryption: value.secp256k1Encryption,
      })),
      execution: {
        All: json.execution.all,
        Index: json.execution.index,
      },
    }
  }

  // private partialJobRegistrationToJSON(job: PartialJobRegistration): any {
  //   return {
  //     ...job,
  //     reward: job.reward.toNumber(),
  //     schedule: job.schedule
  //       ? {
  //           ...job.schedule,
  //           startTime: job.schedule.startTime.getTime(),
  //           endTime: job.schedule.endTime.getTime(),
  //           interval: job.schedule.interval.toNumber(),
  //         }
  //       : undefined,
  //     requiredModules: job.requiredModules ?? [],
  //     minReputation: job.minReputation?.toNumber(),
  //   }
  // }
}

// const processHeartbeats = (
//   heartbeats: Codec[],
//   processors: string[],
//   api: ApiPromise
// ) =>
//   heartbeats.map((value, index) => {
//     const heartbeat = api.createType('Option<u128>', value)
//     return {
//       processor: processors[index],
//       lastSeen: heartbeat.isSome
//         ? new Date(Number(heartbeat.unwrap().toString()))
//         : undefined,
//     }
//   })

// const processVersions = (
//   versions: Codec[],
//   processors: string[],
//   api: ApiPromise
// ) =>
//   versions.map((value, index) => {
//     const version = api.createType(
//       'Option<PalletAcurastProcessorManagerVersion>',
//       value
//     )
//     return {
//       processor: processors[index],
//       version: version.isSome ? codecToVersion(version) : undefined,
//     }
//   })

// const processKeyAttestations = (
//   attestations: Codec[],
//   processors: string[],
//   api: ApiPromise
// ) =>
//   attestations.map((value, index) => ({
//     processor: processors[index],
//     hasKeyAttestation: api.createType(
//       'Option<AcurastCommonBoundedAttestationAttestation>',
//       value
//     ).isSome,
//   }))

// const codecToUpdateInfo = (
//   codec: Codec
// ): { binaryLocation: string; version: Version } => {
//   const json = codec.toPrimitive() as any
//   return {
//     binaryLocation: json.binaryLocation,
//     version: {
//       platform: json.version.platform,
//       buildNumber: json.version.buildNumber,
//     },
//   }
// }

// const codecToVersion = (codec: Codec): Version => {
//   const json = codec.toJSON() as any
//   return {
//     platform: json.platform,
//     buildNumber: json.buildNumber,
//   }
// }

// const codecToReputation = (codec: Codec): Reputation => {
//   const json = codec.toJSON() as any
//   return {
//     r: new BigNumber(json.r),
//     s: new BigNumber(json.s),
//   }
// }

// const processReputations = (
//   reputations: Codec[],
//   processors: string[],
//   api: ApiPromise
// ) =>
//   reputations.map((params, index) => {
//     const reputation = api
//       .createType('Option<ReputationBetaParameters>', params)
//       .unwrapOr(undefined)
//     return {
//       processor: processors[index],
//       reputation: reputation
//         ? codecToReputation(reputation)
//         : { r: new BigNumber(0), s: new BigNumber(0) },
//     }
//   })

// const codecToAdvertisementPricing = (codec: Codec): AdvertisementPricing => {
//   const json = codec.toJSON() as any
//   return {
//     feePerMillisecond: new BigNumber(json.feePerMillisecond),
//     feePerStorageByte: new BigNumber(json.feePerStorageByte),
//     baseFeePerExecution: new BigNumber(json.baseFeePerExecution),
//     schedulingWindow: { end: new Date(json.schedulingWindow.end) },
//   }
// }

// const codecToAdvertisementRestriction = (
//   codec: Codec
// ): AdvertisementRestriction => {
//   const json = codec.toJSON() as any
//   return {
//     maxMemory: json.maxMemory,
//     networkRequestQuota: json.networkRequestQuota,
//     storageCapacity: json.storageCapacity,
//     allowedConsumers: json.allowedConsumers,
//     availableModules: json.availableModules,
//   }
// }

// const codecToAcurastEnvironment = (codec: Codec): AcurastEnvironment => {
//   const json = codec.toJSON() as any
//   return {
//     publicKey: json.publicKey,
//     variables: json.variables,
//   }
// }
