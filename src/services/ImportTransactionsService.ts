import csvParse from 'csv-parse';
import fs from 'fs';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(path: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);

    const readCSVStream = fs.createReadStream(path);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    // Arrays que vão guardar os dados do CSV
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !value || !type) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    // Buscando no model de Category uma categoria com titulo que já existe no csv
    const findCategoryExistent = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    // Mapeio somente os title das categorias encontradas do BANCO
    const categoryExistTitle = findCategoryExistent.map(
      (category: Category) => category.title,
    );

    // Procuro as categorias que ainda não existem no banco para poder criar depois
    const addCategoryTitles = categories
      .filter(
        // Esse includes verifica se a string do array (category) contém alguma palavra (categoryExistTitle do banco) inclusa .. importante obs que estou negando
        category => !categoryExistTitle.includes(category),
      )
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategory = categoryRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategory);

    const finalCategory = [...newCategory, ...findCategoryExistent];

    const createTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategory.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createTransactions);

    await fs.promises.unlink(path);

    return createTransactions;
  }
}

export default ImportTransactionsService;
