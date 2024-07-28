import { callOpenAILLM } from './anthropic';
import { supabase } from '../integrations/supabase';

// Function to retrieve user secrets
const getUserSecrets = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User not authenticated');
  }

  const { data: secrets, error } = await supabase
    .from('user_secrets')
    .select('secret')
    .eq('user_id', session.user.id)
    .single();

  if (error) {
    throw new Error('Failed to retrieve user secrets');
  }

  return JSON.parse(secrets.secret);
};

// Function to create a new project
const createProject = async (description, systemVersion) => {
  const secrets = await getUserSecrets();
  const gptEngineerTestToken = secrets.GPT_ENGINEER_TEST_TOKEN;

  const response = await fetch(`${systemVersion}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gptEngineerTestToken}`,
    },
    body: JSON.stringify({ description, mode: 'instant' }),
  });
  if (!response.ok) {
    throw new Error('Failed to create project');
  }
  return response.json();
};

// Function to send a chat message to a project
const sendChatMessage = async (projectId, message, systemVersion) => {
  const secrets = await getUserSecrets();
  const gptEngineerTestToken = secrets.GPT_ENGINEER_TEST_TOKEN;

  const response = await fetch(`${systemVersion}/projects/${projectId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gptEngineerTestToken}`,
    },
    body: JSON.stringify({ message, images: [], mode: 'instant' }),
  });
  if (!response.ok) {
    throw new Error('Failed to send chat message');
  }
  return response.json();
};

// Main function to handle user impersonation
export const impersonateUser = async (prompt, systemVersion) => {
  try {
    const systemMessage = {
      role: "system",
      content: `You are an AI assistant impersonating a user interacting with a GPT Engineer system. When you want to send a request to the system, use the <lov-chat-request> XML tag. Here's an example of how you might use it:

<lov-chat-request>
Create a todo app
</lov-chat-request>`
    };

    const userMessage = {
      role: "user",
      content: "Now, based on the following prompt, generate appropriate requests to the GPT Engineer system:\n\n" + prompt
    };

    const chatRequest = await callOpenAILLM([systemMessage, userMessage]);
    
    let projectId = null;
    const results = [];

    // Create a new project
    const project = await createProject(chatRequest, systemVersion);
    projectId = project.id;
    results.push({ type: 'project_created', data: project });
    
    // Send chat message
    const chatResponse = await sendChatMessage(projectId, chatRequest, systemVersion);
    results.push({ type: 'chat_message_sent', data: chatResponse });

    return results;
  } catch (error) {
    console.error('Error in user impersonation:', error);
    throw error;
  }
};