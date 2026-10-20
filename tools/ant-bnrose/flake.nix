{
  description = "Bounded ANT WebRTC observation experiment on NixOS";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/09063bd1f2b36fd9fd793c36dfade7bd40a93dfc";
  outputs = { self, nixpkgs }: {
    devShells.x86_64-linux.default = let
      pkgs = import nixpkgs { system = "x86_64-linux"; };
    in pkgs.mkShell {
      packages = with pkgs; [ chromium nodejs rustup pkg-config openssl clang cmake perl git ];
      LIBCLANG_PATH = "${pkgs.libclang.lib}/lib";
    };
  };
}
