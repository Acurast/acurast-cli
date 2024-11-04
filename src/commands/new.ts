import { Command } from 'commander'
import { exec, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { select } from '@inquirer/prompts'
import * as ora from '../util/ora.js'

const TEMPLATES_REPO = 'https://github.com/Acurast/acurast-example-apps.git'
const TEMPLATES_DIR = 'templates'
const LOCAL_REPO_DIR = 'acurast-templates'

export const addCommandNew = (program: Command) => {
  program
    .command('new <project-name>')
    .description('Create a new Acurast project from a template')
    .action(async (projectName: string) => {
      const spinner = ora.default('Cloning templates repository...')
      spinner.start()

      const projectPath = path.join(process.cwd(), projectName)
      if (fs.existsSync(projectPath)) {
        spinner.fail(`A directory named "${projectName}" already exists.`)
        console.error(
          'Please choose a different project name or delete the existing directory.'
        )
        return
      }

      const localRepoPath = path.join(
        process.cwd(),
        projectName,
        LOCAL_REPO_DIR
      )

      exec(`git clone ${TEMPLATES_REPO} ${localRepoPath}`, async (error) => {
        if (error) {
          spinner.fail('Failed to clone templates repository')
          console.error(`Error: ${error.message}`)
          return
        }

        spinner.succeed('Templates repository cloned successfully')

        const templatesPath = path.join(localRepoPath, TEMPLATES_DIR)
        const templates = fs
          .readdirSync(templatesPath)
          .filter((file) =>
            fs.statSync(path.join(templatesPath, file)).isDirectory()
          )

        const selectedTemplate = await select({
          message: 'Choose a template:',
          choices: templates.map((template) => ({
            value: template,
            name: template,
          })),
        })

        spinner.start('Creating project directory...')

        spinner.succeed('Project directory created')
        spinner.start('Copying template files...')

        const templatePath = path.join(templatesPath, selectedTemplate)
        fs.cpSync(templatePath, projectPath, { recursive: true })

        spinner.succeed('Template files copied successfully')
        spinner.start('Cleaning up...')

        fs.rmSync(localRepoPath, { recursive: true, force: true })

        spinner.succeed('Cleanup completed')
        console.log(
          `\nProject "${projectName}" created successfully using the "${selectedTemplate}" template.`
        )

        spinner.start('Updating package.json...')
        try {
          const packageJsonPath = path.join(projectPath, 'package.json')
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8')
          )
          packageJson.name = projectName
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          )
          spinner.succeed('package.json updated successfully')
        } catch (error) {
          spinner.fail('Failed to update package.json')
          console.error(`Error updating package.json:`, error)
        }

        spinner.start('Initializing git repository...')

        try {
          process.chdir(projectPath)
          execSync('git init', { stdio: 'ignore' })
          spinner.succeed('Git repository initialized')

          spinner.start('Installing dependencies...')
          execSync('npm install', { stdio: 'ignore' })
          spinner.succeed('Dependencies installed')
        } catch (error) {
          spinner.fail(
            'Failed to initialize git repository or install dependencies'
          )
          console.error(`Error:`, error)
        }

        console.log(`\nNext steps:`)
        console.log(`  cd ${projectName}`)
        console.log(`  acurast init`)
      })
    })
}
