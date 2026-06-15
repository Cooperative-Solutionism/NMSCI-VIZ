import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // 类型感知规则：需 projectService 拉起对应 tsconfig，捕获 await/promise/condition 类问题。
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 允许解构「剔除字段」的惯用法：const { secret: _omit, ...rest } = obj。
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // 测试文件放宽类型感知里对 mock/Response stub 的 no-unsafe-* 噪声（断言层不值得为之加注解），
  // 以及对「返回定值的异步 SDK mock」放宽 require-await（mock 需与真实异步签名一致）。
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      // testing-library 的 getByLabelText 返回类型在 eslint 的 projectService 程序里与 tsc -b
      // 解析不一致，导致对 `as HTMLInputElement` 误报「冗余断言」（删除后 tsc 反而报 .value 不存在）。
      // 该规则在测试程序里不可靠，测试文件关闭；源码仍保留。
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
])
