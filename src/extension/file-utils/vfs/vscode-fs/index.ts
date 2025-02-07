import { constants, ReadStream, WriteStream } from 'fs'
import { hasOwnProperty } from '@shared/utils/common'

import type { OptimizedIFS } from '../helpers/utils'
import { access } from './access'
import { appendFile } from './append-file'
import { close } from './close'
import { createReadStream } from './create-read-stream'
import { createWriteStream } from './create-write-stream'
import { exists } from './exists'
import { link } from './link'
import { lstat } from './lstat'
import { mkdir } from './mkdir'
import { open } from './open'
import { read } from './read'
import { readFile } from './read-file'
import { readdir } from './readdir'
import { readlink } from './readlink'
import { realpath } from './realpath'
import { rename } from './rename'
import { rm } from './rm'
import { rmdir } from './rmdir'
import { stat } from './stat'
import { symlink } from './symlink'
import { truncate } from './truncate'
import { unlink } from './unlink'
import { unwatchFile } from './unwatch-file'
import { watch } from './watch'
import { watchFile } from './watch-file'
import { write } from './write'
import { writeFile } from './write-file'

export class VsCodeFS implements OptimizedIFS {
  // Implemented methods
  access = access

  appendFile = appendFile

  close = close

  exists = exists

  link = link

  lstat = lstat

  mkdir = mkdir

  open = open

  read = read

  readdir = readdir

  readFile = readFile

  readlink = readlink

  realpath = realpath

  rename = rename

  rmdir = rmdir

  rm = rm

  stat = stat

  symlink = symlink

  truncate = truncate

  unlink = unlink

  unwatchFile = unwatchFile

  watch = watch

  watchFile = watchFile

  write = write

  writeFile = writeFile

  createReadStream = createReadStream

  createWriteStream = createWriteStream

  // Declare types for unsupported sync methods
  readFileSync!: OptimizedIFS['readFileSync']

  writeFileSync!: OptimizedIFS['writeFileSync']

  readlinkSync!: OptimizedIFS['readlinkSync']

  writeSync!: OptimizedIFS['writeSync']

  readSync!: OptimizedIFS['readSync']

  statSync!: OptimizedIFS['statSync']

  mkdirSync!: OptimizedIFS['mkdirSync']

  readdirSync!: OptimizedIFS['readdirSync']

  unlinkSync!: OptimizedIFS['unlinkSync']

  accessSync!: OptimizedIFS['accessSync']

  appendFileSync!: OptimizedIFS['appendFileSync']

  chmodSync!: OptimizedIFS['chmodSync']

  chownSync!: OptimizedIFS['chownSync']

  closeSync!: OptimizedIFS['closeSync']

  existsSync!: OptimizedIFS['existsSync']

  fchmodSync!: OptimizedIFS['fchmodSync']

  fchownSync!: OptimizedIFS['fchownSync']

  fstatSync!: OptimizedIFS['fstatSync']

  fsyncSync!: OptimizedIFS['fsyncSync']

  ftruncateSync!: OptimizedIFS['ftruncateSync']

  futimesSync!: OptimizedIFS['futimesSync']

  lchmodSync!: OptimizedIFS['lchmodSync']

  lchownSync!: OptimizedIFS['lchownSync']

  linkSync!: OptimizedIFS['linkSync']

  lstatSync!: OptimizedIFS['lstatSync']

  openSync!: OptimizedIFS['openSync']

  realpathSync!: OptimizedIFS['realpathSync']

  renameSync!: OptimizedIFS['renameSync']

  rmdirSync!: OptimizedIFS['rmdirSync']

  symlinkSync!: OptimizedIFS['symlinkSync']

  truncateSync!: OptimizedIFS['truncateSync']

  utimesSync!: OptimizedIFS['utimesSync']

  // Declare types for unsupported async methods
  chmod!: OptimizedIFS['chmod']

  chown!: OptimizedIFS['chown']

  fchmod!: OptimizedIFS['fchmod']

  fchown!: OptimizedIFS['fchown']

  fstat!: OptimizedIFS['fstat']

  fsync!: OptimizedIFS['fsync']

  ftruncate!: OptimizedIFS['ftruncate']

  futimes!: OptimizedIFS['futimes']

  lchmod!: OptimizedIFS['lchmod']

  lchown!: OptimizedIFS['lchown']

  utimes!: OptimizedIFS['utimes']

  // Unsupported async methods with error throwing
  private unsupportedMethods = [
    'chmod',
    'chown',
    'fchmod',
    'fchown',
    'fdatasync',
    'fstat',
    'fsync',
    'ftruncate',
    'futimes',
    'lchmod',
    'lchown',
    'utimes',

    // Sync methods
    'accessSync',
    'appendFileSync',
    'chmodSync',
    'chownSync',
    'closeSync',
    'existsSync',
    'fchmodSync',
    'fchownSync',
    'fdatasyncSync',
    'fstatSync',
    'fsyncSync',
    'ftruncateSync',
    'futimesSync',
    'lchmodSync',
    'lchownSync',
    'linkSync',
    'lstatSync',
    'mkdirSync',
    'openSync',
    'readdirSync',
    'readFileSync',
    'readlinkSync',
    'readSync',
    'realpathSync',
    'renameSync',
    'rmdirSync',
    'statSync',
    'symlinkSync',
    'truncateSync',
    'unlinkSync',
    'utimesSync',
    'writeFileSync',
    'writeSync'
  ]

  // Constants
  constants = constants

  WriteStream: OptimizedIFS['WriteStream'] = WriteStream

  ReadStream: OptimizedIFS['ReadStream'] = ReadStream

  promises!: OptimizedIFS['promises']

  private promisesMethods: (keyof OptimizedIFS['promises'])[] = [
    'access',
    'appendFile',
    'copyFile',
    'cp',
    'link',
    'lstat',
    'mkdir',
    'mkdtemp',
    'open',
    'opendir',
    'readdir',
    'readFile',
    'readlink',
    'realpath',
    'rename',
    'rm',
    'rmdir',
    'stat',
    'symlink',
    'truncate',
    'unlink',
    'watch',
    'writeFile'
  ]

  constructor() {
    // Initialize unsupported methods to throw errors
    this.unsupportedMethods.forEach(method => {
      ;(this as any)[method] = () => {
        throw new Error(
          `Method ${method} is not supported in VSCode file system`
        )
      }
    })

    const promises: OptimizedIFS['promises'] = {
      constants
    } as OptimizedIFS['promises']

    this.promisesMethods.forEach(method => {
      if (typeof (this as any)[method] !== 'function') {
        ;(promises as any)[method] = () => {
          throw new Error(`Method ${method} is not implemented`)
        }
      } else if (hasOwnProperty((this as any)[method], '__promisify__')) {
        ;(promises as any)[method] = (...args: any[]) =>
          (this as any)[method].__promisify__(...args)
      } else {
        ;(promises as any)[method] = (...args: any[]) =>
          (this as any)[method](...args)
      }
    })

    this.promises = promises
  }
}
