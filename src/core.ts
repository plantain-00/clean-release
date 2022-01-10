import type * as childProcess from 'child_process'
import type * as cleanScripts from 'clean-scripts'

interface Context {
  dir: string
  version: string
  tag?: string | number
  effectedWorkspacePaths?: string[][]
}

type Script = string | ((context: Context) => cleanScripts.Script) | ((context: Context) => Promise<cleanScripts.Script>) | undefined

/**
 * @public
 */
export type ConfigData = Configuration

export interface Configuration {
  include: string[];
  exclude?: string[];
  base?: string | string[];
  postScript?: Script | Script[];
  releaseRepository?: string;
  releaseBranchName?: string;
  notClean?: boolean;
  askVersion?: boolean;
  changesGitStaged?: boolean;
  execOptions?: childProcess.ExecOptions;
  onlyChangedPackages?: boolean
}
