import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category); // Cria um repositório a partir dessa model Category, como o de cima já existia um repository, utilizou o getCustom e não só getRepository

    const balance = await transactionRepository.getBalance();

    if (type === 'outcome' && value > balance.total) {
      throw new AppError('Extrapolated limit', 400);
    }

    let transactionsCategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!transactionsCategory) {
      transactionsCategory = categoryRepository.create({
        title: category,
      });

      await categoryRepository.save(transactionsCategory);
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: transactionsCategory,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
