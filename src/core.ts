import type * as childProcess from 'child_process'

interface Context {
  dir: string
  version: string
  tag?: string | number
}

type Script = string | ((context: Context) => string | undefined) | ((context: Context) => Promise<string | undefined>) | undefined

export interface ConfigData {
  include: string[];
  exclude?: string[];
  base?: string;
  postScript?: Script | Script[];
  releaseRepository?: string;
  releaseBranchName?: string;
  notClean?: boolean;
  askVersion?: boolean;
  changesGitStaged?: boolean;
  execOptions?: childProcess.ExecOptions;
}
