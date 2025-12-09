import { consultEngineerTool } from '../consultEngineer.js';

// Mocks for dependencies used inside consultEngineerTool
const mockApiClient = {
  createTask: jest.fn(),
  getTaskStatus: jest.fn(),
};

const mockAuthManagerInstance = {
  isAuthenticated: jest.fn(),
};

const mockConfigManagerInstance = {
  isInitialized: jest.fn(),
  loadConfig: jest.fn(),
};

jest.mock('../../modules/api.js', () => {
  return {
    ApiClient: jest.fn(() => mockApiClient),
  };
});

jest.mock('../../modules/auth.js', () => {
  return {
    AuthManager: jest.fn(() => mockAuthManagerInstance),
  };
});

jest.mock('../../modules/config.js', () => {
  return {
    ConfigManager: jest.fn(() => mockConfigManagerInstance),
  };
});

describe('consultEngineer tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthManagerInstance.isAuthenticated.mockReturnValue(true);
    mockConfigManagerInstance.isInitialized.mockReturnValue(true);
    mockConfigManagerInstance.loadConfig.mockReturnValue({
      projectId: 'proj-123',
      ai: {
        tools: {
          consultEngineer: {
            maxCreditsPerCall: 12,
          },
        },
      },
    });

    mockApiClient.createTask.mockResolvedValue({
      taskId: 'task-1',
      creditsRemaining: 100,
      warning: undefined,
    });

    mockApiClient.getTaskStatus.mockResolvedValue({
      status: 'completed',
      response: 'Here is your answer',
      engineerName: 'Test Engineer',
      actualCreditsUsed: '3',
    });
  });

  it('creates a realtime_answer task and returns engineer response', async () => {
    const result = await consultEngineerTool.execute({
      question: 'How does feature X work?',
      context: 'Relevant context here',
      urgency: 'normal',
    });

    expect(result.success).toBe(true);
    expect(result.data?.answer).toBe('Here is your answer');
    expect(result.data?.engineerName).toBe('Test Engineer');
    expect(result.data?.creditsUsed).toBe(3);

    expect(mockApiClient.createTask).toHaveBeenCalledTimes(1);
    const createTaskPayload = mockApiClient.createTask.mock.calls[0][0];
    expect(createTaskPayload).toMatchObject({
      projectId: 'proj-123',
      taskMode: 'realtime_answer',
      maxCredits: 12, // from config maxCreditsPerCall
    });
    expect(createTaskPayload.issueDescription).toContain('How does feature X work?');
    expect(createTaskPayload.issueDescription).toContain('Relevant context here');

    expect(mockApiClient.getTaskStatus).toHaveBeenCalledWith('task-1');
  });
});
