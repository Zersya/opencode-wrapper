declare module "dockerode" {
  interface ContainerInfo {
    Id: string
    Names: string[]
    Image: string
    ImageID: string
    Command: string
    Created: number
    State: string
    Status: string
    Ports: Port[]
    Labels: Record<string, string>
    SizeRw?: number
    SizeRootFs?: number
    HostConfig?: HostConfig
    NetworkSettings?: NetworkSettings
    Mounts?: Mount[]
  }

  interface Port {
    IP: string
    PrivatePort: number
    PublicPort: number
    Type: string
  }

  interface HostConfig {
    Binds?: string[]
    Memory?: number
    CpuShares?: number
    AutoRemove?: boolean
    PortBindings?: Record<string, { HostPort: string }[]>
    Privileged?: boolean
    NetworkMode?: string
  }

  interface NetworkSettings {
    Networks: Record<string, Network>
  }

  interface Network {
    IPAMConfig?: IPAMConfig
    Links?: string[]
    Aliases?: string[]
    NetworkID: string
    EndpointID: string
    Gateway: string
    IPAddress: string
    IPPrefixLen: number
    IPv6Gateway: string
    GlobalIPv6Address: string
    GlobalIPv6PrefixLen: number
    MacAddress: string
  }

  interface IPAMConfig {
    Subnet: string
    IPRange: string
    Gateway: string
  }

  interface Mount {
    Type: string
    Name?: string
    Source: string
    Destination: string
    Driver?: string
    Mode: string
    RW: boolean
    Propagation: string
  }

  interface ContainerCreateOptions {
    Image: string
    name?: string
    Env?: string[]
    WorkingDir?: string
    Tty?: boolean
    OpenStdin?: boolean
    HostConfig?: HostConfig
    Labels?: Record<string, string>
    Cmd?: string[]
    Entrypoint?: string | string[]
    ExposedPorts?: Record<string, {}>
    Volumes?: Record<string, {}>
    User?: string
    StopSignal?: string
    StopTimeout?: number
    Healthcheck?: HealthConfig
  }

  interface HealthConfig {
    Test: string[]
    Interval?: number
    Timeout?: number
    Retries?: number
    StartPeriod?: number
  }

  interface ExecCreateOptions {
    Cmd: string[]
    AttachStdout?: boolean
    AttachStderr?: boolean
    AttachStdin?: boolean
    Tty?: boolean
    Env?: string[]
    WorkingDir?: string
    User?: string
  }

  interface ExecStartOptions {
    Detach?: boolean
    Tty?: boolean
    Console?: boolean
  }

  interface ExecInspectInfo {
    ID: string
    Running: boolean
    ExitCode: number | null
    ProcessConfig: {
      tty: boolean
      entrypoint: string
      arguments: string[]
      user: string
      privileged: boolean
    }
    OpenStdin: boolean
    OpenStderr: boolean
    OpenStdout: boolean
    ContainerID: string
    Pid: number
  }

  interface Container {
    id: string
    start(): Promise<void>
    stop(options?: { t?: number }): Promise<void>
    restart(options?: { t?: number }): Promise<void>
    kill(signal?: string): Promise<void>
    remove(options?: { force?: boolean; v?: boolean; link?: boolean }): Promise<void>
    inspect(): Promise<ContainerInspectInfo>
    exec(options: ExecCreateOptions): Promise<Exec>
    wait(): Promise<{ Error: { Error?: string; Message?: string } | null; StatusCode: number }>
    getArchive(options: { path: string }): Promise<NodeJS.ReadableStream>
    putArchive(stream: NodeJS.ReadableStream, options: { path: string; noOverwriteDirNonDir?: string }): Promise<void>
    stats(options?: { stream?: boolean }): Promise<NodeJS.ReadableStream>
  }

  interface ContainerInspectInfo {
    Id: string
    Created: string
    Path: string
    Args: string[]
    State: {
      Status: string
      Running: boolean
      Paused: boolean
      Restarting: boolean
      OOMKilled: boolean
      Dead: boolean
      Pid: number
      ExitCode: number
      Error: string
      StartedAt: string
      FinishedAt: string
      Health?: {
        Status: string
        FailingStreak: number
        Log: Array<{
          Start: string
          End: string
          ExitCode: number
          Output: string
        }>
      }
    }
    Image: string
    ResolvConfPath: string
    HostnamePath: string
    HostsPath: string
    LogPath: string
    Name: string
    RestartCount: number
    Driver: string
    Platform: string
    MountLabel: string
    ProcessLabel: string
    AppArmorProfile: string
    ExecIDs?: string[]
    HostConfig: HostConfig
    GraphDriver: {
      Name: string
      Data: Record<string, string>
    }
    Config: {
      Hostname: string
      Domainname: string
      User: string
      AttachStdin: boolean
      AttachStdout: boolean
      AttachStderr: boolean
      ExposedPorts?: Record<string, {}>
      Tty: boolean
      OpenStdin: boolean
      StdinOnce: boolean
      Env?: string[]
      Cmd?: string[]
      Image: string
      Volumes?: Record<string, {}>
      WorkingDir: string
      Entrypoint?: string | string[]
      Labels: Record<string, string>
      StopSignal: string
      StopTimeout?: number
    }
  }

  interface Exec {
    id: string
    start(options: ExecStartOptions): Promise<NodeJS.ReadableStream>
    inspect(): Promise<ExecInspectInfo>
    resize(options: { h: number; w: number }): Promise<void>
  }

  interface DockerOptions {
    socketPath?: string
    host?: string
    port?: number
    username?: string
    password?: string
    ca?: string
    cert?: string
    key?: string
    timeout?: number
    version?: string
    protocol?: string
  }

  interface ImageInfo {
    Id: string
    ParentId: string
    RepoTags: string[]
    RepoDigests: string[]
    Created: number
    Size: number
    VirtualSize: number
    SharedSize: number
    Labels: Record<string, string>
    Containers: number
  }

  interface NetworkInfo {
    Id: string
    Name: string
    Scope: string
    Driver: string
    EnableIPv6: boolean
    IPAM: {
      Driver: string
      Config: Array<{
        Subnet: string
        IPRange?: string
        Gateway: string
        AuxiliaryAddresses?: Record<string, string>
      }>
      Options: Record<string, string>
    }
    Internal: boolean
    Attachable: boolean
    Ingress: boolean
    ConfigFrom?: {
      Network: string
    }
    ConfigOnly: boolean
    Containers?: Record<string, {
      Name: string
      EndpointID: string
      MacAddress: string
      IPv4Address: string
      IPv6Address: string
    }>
    Options: Record<string, string>
    Labels: Record<string, string>
  }

  class Container {}
  class Image {}
  class Network {}
  class Volume {}
  class Exec {}
  class Service {}
  class Task {}
  class Node {}
  class Secret {}
  class Config {}

  interface Modem {
    dial(options: {
      path: string
      method: string
      options?: Record<string, unknown>
      abortSignal?: AbortSignal
      statusCodes?: Record<string, boolean>
      file?: NodeJS.ReadableStream
      isStream?: boolean
      hijack?: boolean
      openStdin?: boolean
    }): Promise<NodeJS.ReadableStream>
  }

  interface BuildImageOptions {
    t?: string
    dockerfile?: string
    buildargs?: Record<string, string>
    cachefrom?: string[]
    extrahosts?: string[]
    labels?: Record<string, string>
    network?: string
    no_cache?: boolean
    pull?: string
    platform?: string
    quiet?: boolean
    rm?: boolean
    forcerm?: boolean
    memory?: number
    memswap?: number
    cpushares?: number
    cpusetcpus?: string
    cpuperiod?: number
    cpuquota?: number
    shmsize?: number
    squash?: boolean
    remote?: string
    auth?: string
  }

  export default class Docker {
    constructor(options?: DockerOptions)
    modem: Modem
    ping(): Promise<string>
    version(): Promise<{ Version: string; ApiVersion: string; GitCommit: string; GoVersion: string; Os: string; Arch: string; KernelVersion: string; BuildTime: string }>
    info(): Promise<Record<string, unknown>>
    createContainer(options: ContainerCreateOptions): Promise<Container>
    getContainer(id: string): Container
    listContainers(options?: { all?: boolean; limit?: number; filters?: Record<string, string[]> }): Promise<ContainerInfo[]>
    buildImage(context: string | { context: string; src: string[] }, options?: BuildImageOptions): Promise<NodeJS.ReadableStream>
    createImage(options: { fromImage: string }): Promise<NodeJS.ReadableStream>
    getImage(name: string): Image
    listImages(options?: { all?: boolean; filters?: Record<string, string[]>; digests?: boolean }): Promise<ImageInfo[]>
    createNetwork(options: { Name: string; CheckDuplicate?: boolean; Driver?: string; EnableIPv6?: boolean; IPAM?: IPAM; Internal?: boolean; Attachable?: boolean; Ingress?: boolean; Labels?: Record<string, string>; Options?: Record<string, string> }): Promise<{ Id: string; Warning: string }>
    getNetwork(id: string): Network
    listNetworks(options?: { filters?: Record<string, string[]> }): Promise<NetworkInfo[]>
    createVolume(options?: { Name?: string; Driver?: string; DriverOpts?: Record<string, string>; Labels?: Record<string, string> }): Promise<{ Name: string; Driver: string; Mountpoint: string; CreatedAt: string; Status?: Record<string, unknown>; Labels: Record<string, string>; Scope: string }>
    getVolume(name: string): Volume
    listVolumes(options?: { filters?: Record<string, string[]> }): Promise<{ Volumes: Array<{ Name: string; Driver: string; Mountpoint: string; CreatedAt: string; Status?: Record<string, unknown>; Labels: Record<string, string>; Scope: string }> }>
    pull(repoTag: string, options?: Record<string, unknown>, callback?: (error: Error | null, stream: NodeJS.ReadableStream) => void): Promise<NodeJS.ReadableStream>
  }
}
