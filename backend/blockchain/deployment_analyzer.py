import json
import datetime
from typing import Optional, Dict, Any
from web3 import Web3
from eth_utils import to_checksum_address, is_address

# Middleware import for POA chains (Ganache etc)
try:
    from web3.middleware import geth_poa_middleware
except ImportError:
    try:
        from web3.middleware.geth_poa import geth_poa_middleware
    except ImportError:
        geth_poa_middleware = None
        print("Warning: POA middleware not available - some Ganache features may be limited")

class DeploymentAnalyzer:
    def __init__(self, contract_address: Optional[str] = None, rpc_url: Optional[str] = None):
        if contract_address and not is_address(contract_address):
            raise ValueError("Invalid Ethereum address provided")
            
        self.contract_address = to_checksum_address(contract_address) if contract_address else None
        self.rpc_url = rpc_url or "http://localhost:8545"
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        if geth_poa_middleware:
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        else:
            print("Running without POA middleware - using basic connection")
        
        if not self.w3.isConnected():
            raise ConnectionError(
                f"Could not connect to node at {self.rpc_url}\n"
                "1. Make sure Ganache is running with:\n"
                "   ganache --chain.chainId 1337 --wallet.deterministic\n"
                "2. Verify your RPC URL is correct"
            )
            
        self.report = {
            "metadata": {
                "tool_version": "1.0.2",
                "analysis_date": datetime.datetime.now().isoformat(),
                "rpc_provider": self.rpc_url
            },
            "contract_address": self.contract_address,
            "findings": [],
            "deployment_analysis": None,
            "errors": []
        }

    def analyze_deployment(self) -> None:
        if not self.contract_address:
            return

        try:
            creation_tx = self._get_creation_transaction()
            if not creation_tx:
                self.report["errors"].append({
                    "source": "deployment",
                    "error": "Creation transaction not found in last 100 blocks"
                })
                return

            tx_receipt = self.w3.eth.get_transaction_receipt(creation_tx.hash)
            block = self.w3.eth.get_block(tx_receipt.blockNumber)
            
            self.report["deployment_analysis"] = {
                "deployer": creation_tx["from"],
                "tx_hash": creation_tx.hash.hex(),
                "block": tx_receipt.blockNumber,
                "gas_used": tx_receipt.gasUsed,
                "gas_price_gwei": str(self.w3.fromWei(creation_tx.gasPrice, 'gwei')) + " gwei",
                "timestamp": datetime.datetime.fromtimestamp(block.timestamp).isoformat()
            }

        except Exception as e:
            self.report["errors"].append({
                "source": "deployment",
                "error": str(e)
            })

    def _get_creation_transaction(self):
        try:
            latest = self.w3.eth.block_number
            # Search last 100 blocks for creation tx of this contract
            for block_num in range(latest, max(0, latest - 100), -1):
                block = self.w3.eth.get_block(block_num, full_transactions=True)
                for tx in block.transactions:
                    if tx.to is None:
                        receipt = self.w3.eth.get_transaction_receipt(tx.hash)
                        if receipt.contractAddress == self.contract_address:
                            return tx
        except Exception:
            return None

    def generate_report(self, output_file: Optional[str] = None) -> Dict[str, Any]:
        if self.contract_address:
            self.analyze_deployment()
        
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(self.report, f, indent=2)
        
        return self.report

if __name__ == "__main__":
    try:
        analyzer = DeploymentAnalyzer(
            contract_address="0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab",  # Replace with your contract address
            rpc_url="http://localhost:8545"
        )
        
        print(f"Connected: {analyzer.w3.isConnected()}")
        print(f"Chain ID: {analyzer.w3.eth.chain_id}")
        
        report = analyzer.generate_report("contract_analysis.json")
        print(json.dumps(report, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}")
        if "Connection" in str(e):
            print("\nTROUBLESHOOTING:")
            print("1. Install correct package versions:")
            print("   pip install web3==5.31.0 eth-account==0.5.9 eth-abi==2.2.0")
            print("2. Start Ganache in another terminal:")
            print("   ganache --chain.chainId 1337 --wallet.deterministic")