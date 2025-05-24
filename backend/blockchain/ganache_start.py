import subprocess
import time
from web3 import Web3
from solcx import compile_source
from deployment_analyzer import DeploymentAnalyzer

GANACHE_CMD = "ganache --chain.chainId 1337 --wallet.deterministic"
GANACHE_PORT = 8545

def start_ganache():
    print("[*] Starting Ganache...")
    return subprocess.Popen(GANACHE_CMD, shell=True, stdout=subprocess.DEVNULL)

def deploy_contract(w3, contract_source: str):
    compiled_sol = compile_source(contract_source)
    contract_id, contract_interface = compiled_sol.popitem()
    
    acct = w3.eth.accounts[0]
    Contract = w3.eth.contract(abi=contract_interface['abi'], bytecode=contract_interface['bin'])
    tx_hash = Contract.constructor().transact({'from': acct})
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"[+] Deployed at: {tx_receipt.contractAddress}")
    return tx_receipt.contractAddress

def main():
    ganache_proc = start_ganache()
    time.sleep(3)

    try:
        rpc_url = f"http://localhost:{GANACHE_PORT}"
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.isConnected():
            raise Exception("Ganache not connected")

        print("[*] Compiling and deploying contract...")
        with open("contract.sol", "r") as f:
            contract_source = f.read()

        contract_address = deploy_contract(w3, contract_source)

        print("[*] Running deployment analyzer...")
        analyzer = DeploymentAnalyzer(contract_address=contract_address, rpc_url=rpc_url)
        report = analyzer.generate_report("contract_analysis.json")
        print("[*] Report saved to contract_analysis.json")

    finally:
        print("[*] Stopping Ganache...")
        ganache_proc.terminate()
        ganache_proc.wait()

if __name__ == "__main__":
    main()