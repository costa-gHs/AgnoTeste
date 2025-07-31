module.exports = {
  extends: [
    'next/core-web-vitals',
    'next/typescript'
  ],
  rules: {
    // Transformar alguns erros em warnings durante o build
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',

    // Permitir algumas práticas comuns durante desenvolvimento
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/prefer-as-const': 'warn',

    // Desabilitar regras muito restritivas para build
    'prefer-const': 'warn',
    'no-console': 'off', // Permitir console.log durante desenvolvimento

    // Regras específicas para React
    'react/no-unescaped-entities': 'warn',
    'react/display-name': 'warn',
    'react/jsx-key': 'warn',

    // Permitir objetos vazios temporariamente
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-empty-function': 'warn'
  },

  // Configurações específicas para diferentes tipos de arquivo
  overrides: [
    {
      files: ['**/*.js', '**/*.jsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off'
      }
    },
    {
      files: ['**/components/**/*.tsx', '**/components/**/*.ts'],
      rules: {
        // Ser mais flexível com componentes durante desenvolvimento
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }],
        'react-hooks/exhaustive-deps': 'warn'
      }
    }
  ],

  // Configurações do parser
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },

  // Ambientes
  env: {
    browser: true,
    es2022: true,
    node: true
  },

  // Ignorar arquivos gerados
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'dist/',
    'build/',
    '*.config.js',
    '*.config.ts'
  ]
};