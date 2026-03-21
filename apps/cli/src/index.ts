import { Command } from 'commander'
import { registerMenuCommands } from './commands/menu.ts'
import { registerRecipesCommands } from './commands/recipes.ts'
import { registerUsersCommands } from './commands/users.ts'
import { registerJobsCommands } from './commands/jobs.ts'
import { registerDbCommands } from './commands/db.ts'

const program = new Command()

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
