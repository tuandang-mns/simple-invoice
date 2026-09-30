import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostWith(reply: { status: jest.Mock; send: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ method: 'GET', url: '/x', id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let reply: { status: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    reply = { status: jest.fn(), send: jest.fn() };
    reply.status.mockReturnValue(reply);
  });

  it('formats HttpExceptions as { statusCode, message, error }', () => {
    filter.catch(new NotFoundException('Invoice not found'), hostWith(reply));
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    });
  });

  it('keeps validation messages as an array', () => {
    filter.catch(
      new BadRequestException(['dueDate must be on or after invoiceDate']),
      hostWith(reply),
    );
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('hides internals of unknown errors behind a generic 500', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('password=hunter2 leaked in stack'), hostWith(reply));
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(logged).toHaveBeenCalled(); // details go to the server log, not the client
  });
});
