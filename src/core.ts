import type * as childProcess from 'child_process'
import type * as cleanScripts from 'clean-scripts'

interface Context {
  dir: string
  version: string
  tag?: string | number
}

type Script = string | ((context: Context) => cleanScripts.Script) | ((context: Context) => Promise<cleanScripts.Script>) | undefined

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
