import unittest
import sys
import os

# Adiciona o diretório 'backend' ao sys.path para que seja reconhecido como um pacote
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

# Descobre e executa os testes no diretório 'backend/tests'
loader = unittest.TestLoader()
suite = loader.discover('tests')

runner = unittest.TextTestRunner()
result = runner.run(suite)

# Sai com um código de erro se algum teste falhar
if not result.wasSuccessful():
    sys.exit(1)
