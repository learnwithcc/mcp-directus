#!/usr/bin/env node
/**
 * CLI tool for policy and role management in Directus
 * 
 * This tool provides commands for creating, listing, and assigning access policies and roles.
 * It includes detailed instructions for manual assignment when automated approaches fail.
 */
import axios from 'axios';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import dotenv from 'dotenv';
import { createAccessPolicy } from '../tools/createAccessPolicy';
import { createRole } from '../tools/createRole';
import { improvedAssignPolicyToRole } from '../tools/improvedAssignPolicyToRole';
import { createLogger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Create a logger for this CLI tool
const logger = createLogger({ component: 'policy-management-cli' });

// Create the main program
const program = new Command();

// Configure the program
program
  .name('policy-management')
  .description('CLI tool for managing Directus access policies and roles')
  .version('1.0.0');

// Get configuration from environment variables or prompt for them
let directusUrl = process.env.DIRECTUS_URL;
let directusToken = process.env.DIRECTUS_ADMIN_TOKEN;

// Global Directus API client
let directusClient: any;

// Initialize the Directus API client
async function initDirectusClient() {
  if (!directusUrl || !directusToken) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'directusUrl',
        message: 'Enter the Directus URL:',
        default: 'http://localhost:8077',
        when: !directusUrl
      },
      {
        type: 'password',
        name: 'directusToken',
        message: 'Enter the Directus admin token:',
        when: !directusToken
      }
    ]);
    
    if (answers.directusUrl) directusUrl = answers.directusUrl;
    if (answers.directusToken) directusToken = answers.directusToken;
  }
  
  // Create Directus API client
  directusClient = axios.create({
    baseURL: directusUrl,
    headers: {
      'Authorization': `Bearer ${directusToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Initialize our tools
  return {
    createPolicyFn: createAccessPolicy(directusClient),
    createRoleFn: createRole(directusClient),
    assignPolicyFn: improvedAssignPolicyToRole(directusClient)
  };
}

// Command: List all policies
program
  .command('list-policies')
  .description('List all existing access policies')
  .action(async () => {
    try {
      await initDirectusClient();
      
      const spinner = ora('Loading policies...').start();
      
      try {
        const response = await directusClient.get('/policies');
        const policies = response.data.data;
        
        spinner.succeed(`Found ${policies.length} policies`);
        
        if (policies.length === 0) {
          console.log(chalk.yellow('No policies found.'));
          return;
        }
        
        console.log(chalk.cyan('\nACCESS POLICIES:\n'));
        
        policies.forEach((policy: any, index: number) => {
          console.log(chalk.green(`${index + 1}. ${policy.name} (${policy.id})`));
          console.log(`   Description: ${policy.description || 'N/A'}`);
          console.log(`   App Access: ${policy.app_access ? 'Yes' : 'No'}`);
          console.log(`   Admin Access: ${policy.admin_access ? 'Yes' : 'No'}`);
          console.log(`   Enforce 2FA: ${policy.enforce_tfa ? 'Yes' : 'No'}`);
          console.log();
        });
      } catch (error: any) {
        spinner.fail(`Error listing policies: ${error.message}`);
        if (error.response?.status === 403) {
          console.log(chalk.red('Permission denied. Your token might not have appropriate permissions.'));
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// Command: List all roles
program
  .command('list-roles')
  .description('List all existing roles')
  .action(async () => {
    try {
      await initDirectusClient();
      
      const spinner = ora('Loading roles...').start();
      
      try {
        const response = await directusClient.get('/roles');
        const roles = response.data.data;
        
        spinner.succeed(`Found ${roles.length} roles`);
        
        if (roles.length === 0) {
          console.log(chalk.yellow('No roles found.'));
          return;
        }
        
        console.log(chalk.cyan('\nROLES:\n'));
        
        for (const role of roles) {
          console.log(chalk.green(`${role.name} (${role.id})`));
          console.log(`   Description: ${role.description || 'N/A'}`);
          
          // Get policies assigned to this role
          try {
            const roleDetailsResponse = await directusClient.get(`/roles/${role.id}`);
            const roleDetails = roleDetailsResponse.data.data;
            const policyIds = roleDetails.policies || [];
            
            if (policyIds.length > 0) {
              console.log(`   Policies: ${policyIds.length}`);
              
              // Get policy details
              for (let i = 0; i < policyIds.length; i++) {
                try {
                  const policyResponse = await directusClient.get(`/policies/${policyIds[i]}`);
                  const policy = policyResponse.data.data;
                  console.log(`      ${i + 1}. ${policy.name} (${policy.id})`);
                } catch (error) {
                  console.log(`      ${i + 1}. Unknown Policy (${policyIds[i]})`);
                }
              }
            } else {
              console.log('   Policies: None');
            }
          } catch (error) {
            console.log('   Policies: Error fetching policy details');
          }
          
          console.log();
        }
      } catch (error: any) {
        spinner.fail(`Error listing roles: ${error.message}`);
        if (error.response?.status === 403) {
          console.log(chalk.red('Permission denied. Your token might not have appropriate permissions.'));
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// Command: Create a new policy
program
  .command('create-policy')
  .description('Create a new access policy')
  .action(async () => {
    try {
      const tools = await initDirectusClient();
      
      // Prompt for policy details
      const policyDetails = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter policy name:',
          validate: (input: string) => input.trim().length > 0 ? true : 'Policy name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Enter policy description (optional):'
        },
        {
          type: 'confirm',
          name: 'app_access',
          message: 'Grant app access?',
          default: true
        },
        {
          type: 'confirm',
          name: 'admin_access',
          message: 'Grant admin access?',
          default: false
        },
        {
          type: 'confirm',
          name: 'enforce_tfa',
          message: 'Enforce two-factor authentication?',
          default: false
        }
      ]);
      
      const spinner = ora('Creating policy...').start();
      
      try {
        const result = await tools.createPolicyFn(policyDetails);
        
        if (result.status === 'success') {
          spinner.succeed(`Policy "${policyDetails.name}" created successfully!`);
          console.log(chalk.green(`Policy ID: ${result.details.policyId}`));
        } else {
          spinner.fail(`Failed to create policy: ${result.message}`);
        }
      } catch (error: any) {
        spinner.fail(`Error creating policy: ${error.message}`);
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// Command: Create a new role
program
  .command('create-role')
  .description('Create a new role')
  .action(async () => {
    try {
      const tools = await initDirectusClient();
      
      // Prompt for role details
      const roleDetails = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter role name:',
          validate: (input: string) => input.trim().length > 0 ? true : 'Role name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Enter role description (optional):'
        },
        {
          type: 'input',
          name: 'icon',
          message: 'Enter role icon:',
          default: 'supervised_user_circle'
        }
      ]);
      
      const spinner = ora('Creating role...').start();
      
      try {
        const result = await tools.createRoleFn(roleDetails);
        
        if (result.status === 'success') {
          spinner.succeed(`Role "${roleDetails.name}" created successfully!`);
          console.log(chalk.green(`Role ID: ${result.details.roleId}`));
        } else {
          spinner.fail(`Failed to create role: ${result.message}`);
        }
      } catch (error: any) {
        spinner.fail(`Error creating role: ${error.message}`);
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// Command: Assign policies to a role
program
  .command('assign-policies')
  .description('Assign policies to a role')
  .action(async () => {
    try {
      const tools = await initDirectusClient();
      
      // Get list of roles
      const spinner = ora('Loading roles and policies...').start();
      
      let roles;
      let policies;
      
      try {
        const rolesResponse = await directusClient.get('/roles');
        roles = rolesResponse.data.data;
        
        const policiesResponse = await directusClient.get('/policies');
        policies = policiesResponse.data.data;
        
        spinner.succeed(`Loaded ${roles.length} roles and ${policies.length} policies`);
      } catch (error: any) {
        spinner.fail(`Error loading data: ${error.message}`);
        return;
      }
      
      // Format options for selection
      const roleOptions = roles.map((role: any) => ({
        name: `${role.name} (${role.id})`,
        value: role.id
      }));
      
      const policyOptions = policies.map((policy: any) => ({
        name: `${policy.name} (${policy.id})`,
        value: policy.id,
        description: policy.description || 'No description'
      }));
      
      // Define interfaces for the answers
      interface AssignmentAnswers {
        roleId: string;
        policyIds: string[];
      }
      
      // Use a properly typed prompt
      const answers = await inquirer.prompt<AssignmentAnswers>({
        type: 'list',
        name: 'roleId',
        message: 'Select a role:',
        choices: roleOptions
      }).then(async (roleAnswer) => {
        const policyAnswer = await inquirer.prompt<AssignmentAnswers>({
          type: 'checkbox',
          name: 'policyIds',
          message: 'Select policies to assign:',
          choices: policyOptions,
          validate: (input: any) => Array.isArray(input) && input.length > 0 ? true : 'Please select at least one policy'
        });
        
        return {
          ...roleAnswer,
          ...policyAnswer
        };
      });
      
      const roleId = answers.roleId;
      const policyIds = answers.policyIds;
      
      // Get selected role and policies for display
      const selectedRole = roles.find((r: any) => r.id === roleId);
      const selectedPolicies = policies.filter((p: any) => policyIds.includes(p.id));
      
      console.log(chalk.cyan('\nAssignment Details:'));
      console.log(chalk.green(`Role: ${selectedRole.name}`));
      console.log(chalk.green('Policies to assign:'));
      selectedPolicies.forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.name}`);
      });
      
      // Confirm assignment
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Do you want to proceed with this assignment?',
          default: true
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Assignment cancelled.'));
        return;
      }
      
      // Attempt to assign policies
      const assignSpinner = ora('Attempting to assign policies...').start();
      
      try {
        const assignmentResult = await tools.assignPolicyFn({
          roleId,
          policyIds,
          useExperimentalApproaches: true
        });
        
        if (assignmentResult.status === 'success') {
          assignSpinner.succeed('Policies assigned successfully!');
          
          // Show which method worked
          const successfulAttempt = assignmentResult.details?.attempts?.find((a: any) => a.success);
          if (successfulAttempt) {
            console.log(chalk.green(`Successful method: ${successfulAttempt.method}`));
          }
        } else {
          assignSpinner.fail(`Automatic assignment failed: ${assignmentResult.message}`);
          
          console.log(chalk.yellow('\nManual Assignment Instructions:'));
          console.log(chalk.cyan('Since automatic assignment failed, you\'ll need to assign the policies manually:'));
          console.log('1. Log into the Directus admin interface');
          console.log('2. Go to Settings > Roles');
          console.log(`3. Click on the "${selectedRole.name}" role`);
          console.log('4. Find the "Policies" field (typically in the form of a multi-select dropdown)');
          console.log('5. Add the following policies:');
          selectedPolicies.forEach((p: any, i: number) => {
            console.log(`   - ${p.name}`);
          });
          console.log('6. Save the role');
          
          // Offer to open the admin interface
          const { openAdmin } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'openAdmin',
              message: 'Would you like to open the Directus admin interface now?',
              default: true
            }
          ]);
          
          if (openAdmin) {
            const adminUrl = directusUrl;
            console.log(chalk.green(`Please open this URL in your browser: ${adminUrl}`));
          }
        }
      } catch (error: any) {
        assignSpinner.fail(`Error during assignment: ${error.message}`);
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Display help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 