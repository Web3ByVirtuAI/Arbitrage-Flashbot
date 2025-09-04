import chalk from 'chalk';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logDir: string = path.join(process.cwd(), 'logs');

  constructor() {
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private writeToFile(entry: LogEntry) {
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const logLine = `${entry.timestamp} [${entry.level}] ${entry.message}${
      entry.data ? ` | Data: ${JSON.stringify(entry.data)}` : ''
    }\n`;
    
    try {
      appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, color: any, message: string, data?: any) {
    if (level > this.logLevel) return;

    const timestamp = this.formatTimestamp();
    const entry: LogEntry = {
      timestamp,
      level: levelName,
      message,
      data
    };

    // Console output with colors
    const formattedMessage = `${chalk.gray(timestamp)} ${color(`[${levelName}]`)} ${message}`;
    console.log(formattedMessage);
    
    if (data) {
      console.log(chalk.gray('Data:'), data);
    }

    // File output
    this.writeToFile(entry);
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, 'ERROR', chalk.red.bold, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, 'WARN', chalk.yellow.bold, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, 'INFO', chalk.blue, message, data);
  }

  success(message: string, data?: any) {
    this.log(LogLevel.INFO, 'SUCCESS', chalk.green.bold, message, data);
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, 'DEBUG', chalk.magenta, message, data);
  }

  trace(message: string, data?: any) {
    this.log(LogLevel.TRACE, 'TRACE', chalk.gray, message, data);
  }

  profit(message: string, amount: string, data?: any) {
    this.log(LogLevel.INFO, 'PROFIT', chalk.green.bold.bgBlack, `💰 ${message} | ${amount} ETH`, data);
  }

  opportunity(message: string, data?: any) {
    this.log(LogLevel.INFO, 'OPPORTUNITY', chalk.yellow.bold, `🎯 ${message}`, data);
  }

  trade(message: string, data?: any) {
    this.log(LogLevel.INFO, 'TRADE', chalk.cyan.bold, `⚡ ${message}`, data);
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }
}

export const logger = new Logger();