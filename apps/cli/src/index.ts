import { Command } from 'commander'
import { registerMenuCommands } from './commands/menu.js'
import { registerRecipesCommands } from './commands/recipes.js'
import { registerUsersCommands } from './commands/users.js'
import { registerJobsCommands } from './commands/jobs.js'
import { registerDbCommands } from './commands/db.js'
import { loadRuntimeEnv } from './lib/runtimeEnv.js'

const program = new Command()

loadRuntimeEnv()

program
  .name('kitchen-cli')
  .description('Kitchen App CLI management tool')
  .version('1.0.0')

registerMenuCommands(program)
registerRecipesCommands(program)
registerUsersCommands(program)
registerJobsCommands(program)
registerDbCommands(program)

program.parse()
