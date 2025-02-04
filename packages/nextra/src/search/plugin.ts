import { sources, webpack } from 'next/dist/compiled/webpack/webpack'
import type { Compiler } from 'webpack'
import { IS_PRODUCTION } from '../constants'
import type { SearchData } from '../types'

export class NextraSearchPlugin {
  apply(compiler: Compiler) {
    const pluginName = this.constructor.name

    compiler.hooks.make.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
        },
        assets => {
          const indexFiles: Record<string, string> = {}

          for (const [, entry] of compilation.entries.entries()) {
            const entryDependency = entry.dependencies?.[0]

            // There are some Next.js refactors that might cause the MDX module
            // to be a dependency of the entry module, instead of the entry
            // itself. This is a workaround to find the MDX module loaded by
            // Nextra
            let entryModule =
              compilation.moduleGraph.getResolvedModule(entryDependency)
            if (!entryModule?.buildInfo?.nextraSearch) {
              for (const dependency of entryModule.dependencies) {
                const mod =
                  compilation.moduleGraph.getResolvedModule(dependency)
                if (mod?.buildInfo?.nextraSearch) {
                  entryModule = mod
                }
              }
            }
            const nextraSearch = entryModule?.buildInfo?.nextraSearch
            if (nextraSearch) {
              const { title, data, indexKey, route } = nextraSearch
              const indexFilename = `nextra-data-${indexKey}.json`
              if (indexFiles[indexFilename] === undefined) {
                indexFiles[indexFilename] = '{'
              }
              if (indexFiles[indexFilename] !== '{') {
                indexFiles[indexFilename] += ','
              }
              const payload: SearchData = {
                [route]: { title, data }
              }
              indexFiles[indexFilename] += JSON.stringify(payload).slice(1, -1)
            }
          }
          for (const [file, content] of Object.entries(indexFiles)) {
            assets[`${IS_PRODUCTION ? '../' : ''}../static/chunks/${file}`] =
              new sources.RawSource(content + '}')
          }
        }
      )
    })
  }
}
