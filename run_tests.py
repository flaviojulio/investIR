import unittest
import sys
import os

# Adiciona o diretório raiz ao path para que 'backend' seja encontrado como um pacote
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Descobre e executa os testes no diretório 'backend/tests'
loader = unittest.TestLoader()
suite = loader.discover('backend/tests')

runner = unittest.TextTestRunner()
result = runner.run(suite)

# Sai com um código de erro se algum teste falhar
if not result.wasSuccessful():
    sys.exit(1)
