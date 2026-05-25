import { Command, Option } from 'commander'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { select } from '@inquirer/prompts'
import * as ora from '../util/ora.js'

const DEFAULT_TEMPLATES_REPO =
  'https://github.com/Acurast/acurast-example-apps.git'
const TEMPLATES_DIR = 'templates'
const LOCAL_REPO_DIR = 'acurast-templates'

const getTemplatesRepo = (): string =>
  process.env.ACURAST_TEMPLATES_REPO ?? DEFAULT_TEMPLATES_REPO

const finishNewProject = (
  projectName: string,
  projectPath: string,
  selectedTemplate: string,
  spinner: ReturnType<typeof ora.default>
) => {
  const packageJsonPath = path.join(projectPath, 'package.json')
  const cargoTomlPath = path.join(projectPath, 'Cargo.toml')
  const hasPackageJson = fs.existsSync(packageJsonPath)
  const hasCargoToml = fs.existsSync(cargoTomlPath)

  if (hasPackageJson) {
    spinner.start('Updating package.json...')
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      packageJson.name = projectName
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      spinner.succeed('package.json updated successfully')
    } catch (error) {
      spinner.fail('Failed to update package.json')
      console.error(`Error updating package.json:`, error)
    }
  }

  spinner.start('Initializing git repository...')
  try {
    const cwd = process.cwd()
    process.chdir(projectPath)
    execSync('git init', { stdio: 'ignore' })
    process.chdir(cwd)
    spinner.succeed('Git repository initialized')
  } catch (error) {
    spinner.fail('Failed to initialize git repository')
    console.error(`Error:`, error)
  }

  if (hasPackageJson) {
    spinner.start('Installing dependencies...')
    try {
      execSync('npm install', { cwd: projectPath, stdio: 'ignore' })
      spinner.succeed('Dependencies installed')
    } catch (error) {
      spinner.fail('Failed to install dependencies')
      console.error(`Error:`, error)
    }
  } else if (hasCargoToml) {
    console.log(`\nCargo project detected. Run \`cargo build\` to compile.`)
  }

  console.log(
    `\nProject "${projectName}" created successfully using the "${selectedTemplate}" template.`
  )
  console.log(`\nNext steps:`)
  console.log(`  cd ${projectName}`)
  console.log(`  acurast init`)
}

export const addCommandNew = (program: Command) => {
  program
    .command('new <project-name>')
    .description('Create a new Acurast project from a template')
    .addOption(
      new Option(
        '--template <name>',
        'Template name (e.g. blank). Skips interactive template selection.'
      )
    )
    .action(async (projectName: string, options: { template?: string }) => {
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

      const localRepoPath = path.join(process.cwd(), LOCAL_REPO_DIR)

      try {
        if (fs.existsSync(localRepoPath)) {
          fs.rmSync(localRepoPath, { recursive: true, force: true })
        }
        execSync(
          `git clone --depth 1 ${getTemplatesRepo()} ${localRepoPath}`,
          { stdio: 'ignore' }
        )
      } catch (error: any) {
        spinner.fail('Failed to clone templates repository')
        console.error(`Error: ${error.message ?? error}`)
        return
      }

      spinner.succeed('Templates repository cloned successfully')

      const templatesPath = path.join(localRepoPath, TEMPLATES_DIR)
      const templates = fs
        .readdirSync(templatesPath)
        .filter((file) =>
          fs.statSync(path.join(templatesPath, file)).isDirectory()
        )

      let selectedTemplate = options.template
      if (selectedTemplate) {
        if (!templates.includes(selectedTemplate)) {
          spinner.fail(`Unknown template "${selectedTemplate}"`)
          console.error(`Available templates: ${templates.join(', ')}`)
          fs.rmSync(localRepoPath, { recursive: true, force: true })
          return
        }
      } else {
        selectedTemplate = await select({
          message: 'Choose a template:',
          choices: templates.map((template) => ({
            value: template,
            name: template,
          })),
        })
      }

      spinner.start('Copying template files...')
      const templatePath = path.join(templatesPath, selectedTemplate)
      fs.cpSync(templatePath, projectPath, { recursive: true })
      spinner.succeed('Template files copied successfully')

      spinner.start('Cleaning up...')
      fs.rmSync(localRepoPath, { recursive: true, force: true })
      spinner.succeed('Cleanup completed')

      finishNewProject(projectName, projectPath, selectedTemplate, spinner)
    })
}
