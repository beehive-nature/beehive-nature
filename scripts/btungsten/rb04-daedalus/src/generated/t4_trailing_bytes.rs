pub mod Daedalus {
  #![allow(nonstandard_style)]
  #[allow(unused_imports)]
  use daedalus_rts_rust as ddl;

  #[allow(unused_imports)]
  use ddl::{Type, Clo};

  #[allow(unused_imports)]
  use serde;

  pub(crate) fn _joinWords_369(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<8>,
    fa2: ddl::U<8>,
  ) -> ddl::U<16> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords369B0(ddl::U<8>, ddl::U<8>),
      JoinWords369B1(ddl::U<8>, ddl::U<8>),
      JoinWords369B2(bool, ddl::U<8>, ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords369B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords369B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(8, 8, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords369B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(8, 8, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords369B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords369B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords369B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt16(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<16>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt16370B0(ddl::U<16>, ddl::Input),
      UInt16370B2(ddl::Input),
      UInt16370B4(ddl::Input, ddl::U<8>, bool, ddl::U<8>),
      UInt16370B5(ddl::Input),
      UInt16370B6(ddl::Input, ddl::Input, bool, ddl::U<8>),
      UInt16370B8(ddl::Input),
      UInt16370B10(ddl::Input, ddl::U<8>, bool),
      UInt16370B11(ddl::Input),
      UInt16370B12(ddl::Input, ddl::Input, bool),
      UInt16370B13(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt16370B13(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt16370B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt16370B2(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:37--6:41",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16370B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          block_id = Goto::UInt16370B0(
            super::Daedalus::_joinWords_369(_state, _arg_2, _arg_3, _arg_1),
            _tmp_0,
          );
          continue '_fun_loop
        },
        Goto::UInt16370B5(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:37--6:41",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16370B6(_arg_1, _arg_0, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UInt16370B5(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16370B4(_arg_0, _tmp_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16370B8(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:31--6:35",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16370B10(_arg_0, _arg_1, _arg_2) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UInt16370B6(_tmp_3, _tmp_0, _arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16370B2(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16370B11(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:31--6:35",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16370B12(_arg_1, _arg_0, _arg_2) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UInt16370B11(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16370B10(_arg_0, _tmp_0, _arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16370B13(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UInt16370B12(_tmp_1, _arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16370B8(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _joinWords_371(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<16>,
    fa2: ddl::U<16>,
  ) -> ddl::U<32> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords371B0(ddl::U<16>, ddl::U<16>),
      JoinWords371B1(ddl::U<16>, ddl::U<16>),
      JoinWords371B2(bool, ddl::U<16>, ddl::U<16>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords371B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords371B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(16, 16, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords371B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(16, 16, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords371B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords371B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords371B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt32(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<32>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt32372B0(ddl::U<32>, ddl::Input),
      UInt32372B1,
      UInt32372B2(ddl::U<16>, ddl::Input, bool, ddl::U<16>),
      UInt32372B3,
      UInt32372B4(ddl::U<16>, ddl::Input, bool),
      UInt32372B5(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt32372B5(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt32372B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt32372B1 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt32372B2(_arg_0, _arg_1, _arg_2, _arg_3) => {
          block_id = Goto::UInt32372B0(
            super::Daedalus::_joinWords_371(_state, _arg_2, _arg_3, _arg_0),
            _arg_1,
          );
          continue '_fun_loop
        },
        Goto::UInt32372B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt32372B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./Daedalus.ddl:7:38--7:43:UInt16");
          match super::Daedalus::UInt16(_state, _arg_1, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt32372B2(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt32372B1;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::UInt32372B5(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:7:31--7:36:UInt16");
          match super::Daedalus::UInt16(_state, _arg_0, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt32372B4(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt32372B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _joinWords_373(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<32>,
    fa2: ddl::U<32>,
  ) -> ddl::U<64> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords373B0(ddl::U<32>, ddl::U<32>),
      JoinWords373B1(ddl::U<32>, ddl::U<32>),
      JoinWords373B2(bool, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords373B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords373B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(32, 32, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords373B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(32, 32, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords373B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords373B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords373B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt64(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt64374B0(ddl::U<64>, ddl::Input),
      UInt64374B1,
      UInt64374B2(ddl::U<32>, ddl::Input, bool, ddl::U<32>),
      UInt64374B3,
      UInt64374B4(ddl::U<32>, ddl::Input, bool),
      UInt64374B5(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt64374B5(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt64374B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt64374B1 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt64374B2(_arg_0, _arg_1, _arg_2, _arg_3) => {
          block_id = Goto::UInt64374B0(
            super::Daedalus::_joinWords_373(_state, _arg_2, _arg_3, _arg_0),
            _arg_1,
          );
          continue '_fun_loop
        },
        Goto::UInt64374B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt64374B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./Daedalus.ddl:8:38--8:43:UInt32");
          match super::Daedalus::UInt32(_state, _arg_1, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt64374B2(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt64374B1;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::UInt64374B5(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:8:31--8:36:UInt32");
          match super::Daedalus::UInt32(_state, _arg_0, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt64374B4(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt64374B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn BEUInt32(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::U<32>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      BEUInt32375B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::BEUInt32375B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::BEUInt32375B0(_arg_0) => {
          _state.push(true, "./Daedalus.ddl:19:50--19:55:UInt32");
          return super::Daedalus::UInt32(_state, _arg_0, true)
        },
      }
    }
  }

  pub(crate) fn BEUInt64(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      BEUInt64376B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::BEUInt64376B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::BEUInt64376B0(_arg_0) => {
          _state.push(true, "./Daedalus.ddl:20:50--20:55:UInt64");
          return super::Daedalus::UInt64(_state, _arg_0, true)
        },
      }
    }
  }

  pub(crate) fn Guard_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Guard377B0(ddl::Input),
      Guard377B1(ddl::Input),
      Guard377B2(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Guard377B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::Guard377B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::Guard377B1(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Pattern match failure");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:64:21--64:29",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Guard377B2(_arg_0, _arg_1) => {
          match _arg_1 {
            false => {
              block_id = Goto::Guard377B1(_arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Guard377B0(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }
}

pub mod WB001 {
  #![allow(nonstandard_style)]
  #[allow(unused_imports)]
  use daedalus_rts_rust as ddl;

  #[allow(unused_imports)]
  use ddl::{Type, Clo};

  #[allow(unused_imports)]
  use serde;

  #[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
  pub struct Envelope {
    pub domain: ddl::Array<ddl::U<8>>,
    pub nonce: ddl::Array<ddl::U<8>>,
    pub epoch: ddl::U<64>,
    pub action: ddl::Array<ddl::U<8>>,
    pub destination: ddl::Array<ddl::U<8>>,
    pub capability: ddl::Array<ddl::U<8>>,
    pub amount: ddl::U<64>,
    pub expiry: ddl::U<64>,
    pub payer: ddl::Array<ddl::U<8>>,
    pub payload: ddl::Array<ddl::U<8>>,
  }

  ddl::serialize_struct!{
    <>, Envelope, (domain, "domain"), (nonce, "nonce"), (epoch, "epoch"), (
      action, "action"
    ), (destination, "destination"), (capability, "capability"), (
      amount, "amount"
    ), (expiry, "expiry"), (payer, "payer"), (payload, "payload")
  }

  ddl::by_ref!{ Envelope }

  pub(crate) fn Header(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Header378B0,
      Header378B1(ddl::Unit, ddl::Input, ddl::U<32>),
      Header378B2(ddl::Input, bool, ddl::U<32>),
      Header378B3(ddl::Input, ddl::U<32>, ddl::U<32>),
      Header378B4(ddl::Input, ddl::U<32>),
      Header378B5,
      Header378B6(ddl::U<32>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header378B8(ddl::Array<ddl::U<8>>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header378B9(ddl::Input, ddl::U<8>),
      Header378B10(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Header378B10(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Header378B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header378B1(_arg_0, _arg_1, _arg_2) => {
          let _tmp_0: ddl::U<64> = _arg_2.cast_to();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Header378B2(_arg_2, _arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:46:5--46:29:Guard_");
          match super::Daedalus::Guard_(_state, _arg_2, _arg_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header378B1(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header378B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header378B3(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= _arg_1;
          block_id = Goto::Header378B2(_arg_2, _tmp_0, _arg_0);
          continue '_fun_loop
        },
        Goto::Header378B4(_arg_1, _arg_0) => {
          block_id = Goto::Header378B2(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::Header378B5 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header378B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_2 <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Header378B4(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header378B3(_arg_1, _arg_0, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::Header378B8(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:45:13--45:20:BEUInt32");
          match super::Daedalus::BEUInt32(_state, _tmp_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header378B6(x, i, _arg_2, _arg_3);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header378B5;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header378B9(_arg_1, _arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ _arg_0 ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:44:6--44:16",
              _arg_1.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header378B10(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = ddl::new_array([ _arg_1 ]);
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Header378B9(_arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header378B8(_tmp_0, _arg_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _class_utf8tail(
    _state: &mut ddl::ParserState,
    fa0: ddl::U<8>,
  ) -> bool {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      ByteClassUtf8tail379B0(ddl::U<8>),
      ByteClassUtf8tail379B1,
      ByteClassUtf8tail379B2(ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::ByteClassUtf8tail379B2(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::ByteClassUtf8tail379B0(_arg_0) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          return _tmp_0
        },
        Goto::ByteClassUtf8tail379B1 => { return false },
        Goto::ByteClassUtf8tail379B2(_arg_0) => {
          let _tmp_0 = <ddl::U<8>>::from(128u64) <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::ByteClassUtf8tail379B1;
              continue '_fun_loop
            },
            true => {
              block_id = Goto::ByteClassUtf8tail379B0(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UTF8Char_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UTF8Char380B0(ddl::Input),
      UTF8Char380B1(ddl::Input),
      UTF8Char380B2(ddl::Input),
      UTF8Char380B3(ddl::Input),
      UTF8Char380B4(ddl::Input),
      UTF8Char380B5(ddl::Input),
      UTF8Char380B6(ddl::Input),
      UTF8Char380B7(ddl::Input),
      UTF8Char380B8(ddl::Input),
      UTF8Char380B9(ddl::Input),
      UTF8Char380B10(ddl::Input),
      UTF8Char380B11(ddl::Input),
      UTF8Char380B12(ddl::Input),
      UTF8Char380B13(ddl::Input),
      UTF8Char380B14(ddl::Input),
      UTF8Char380B15(ddl::Input),
      UTF8Char380B16(ddl::Input),
      UTF8Char380B17(ddl::Input),
      UTF8Char380B18(ddl::Input),
      UTF8Char380B19(ddl::Input),
      UTF8Char380B20(ddl::Input),
      UTF8Char380B21(ddl::Input),
      UTF8Char380B22(ddl::Input),
      UTF8Char380B23(ddl::Input),
      UTF8Char380B24(ddl::Input),
      UTF8Char380B25(ddl::Input),
      UTF8Char380B26(ddl::Input),
      UTF8Char380B27(ddl::Input),
      UTF8Char380B28(ddl::Input),
      UTF8Char380B29(ddl::Input),
      UTF8Char380B30(ddl::Input),
      UTF8Char380B31(ddl::Input),
      UTF8Char380B32(ddl::Input),
      UTF8Char380B33(ddl::Input),
      UTF8Char380B34(ddl::Input),
      UTF8Char380B35(ddl::Input),
      UTF8Char380B36(ddl::Input),
      UTF8Char380B37(ddl::Input),
      UTF8Char380B38(ddl::Input),
      UTF8Char380B39(ddl::Input),
      UTF8Char380B40(ddl::Input),
      UTF8Char380B41(ddl::Input),
      UTF8Char380B42(ddl::Input),
      UTF8Char380B43(ddl::Input),
      UTF8Char380B44(ddl::Input),
      UTF8Char380B45(ddl::Input),
      UTF8Char380B46(ddl::Input),
      UTF8Char380B47(ddl::Input),
      UTF8Char380B48(ddl::Input),
      UTF8Char380B49(ddl::Input),
      UTF8Char380B50(ddl::Input),
      UTF8Char380B51(ddl::Input),
      UTF8Char380B52(ddl::Input),
      UTF8Char380B53(ddl::Input),
      UTF8Char380B54(ddl::Input),
      UTF8Char380B55(ddl::Input),
      UTF8Char380B56(ddl::Input),
      UTF8Char380B57(ddl::Input),
      UTF8Char380B58(ddl::Input),
      UTF8Char380B59(ddl::Input),
      UTF8Char380B60(ddl::Input),
      UTF8Char380B61(ddl::Input),
      UTF8Char380B62(ddl::Input),
      UTF8Char380B63(ddl::Input),
      UTF8Char380B64(ddl::Input),
      UTF8Char380B65(ddl::Input),
      UTF8Char380B66(ddl::Input),
      UTF8Char380B67(ddl::Input),
      UTF8Char380B68(ddl::Input),
      UTF8Char380B69(ddl::Input),
      UTF8Char380B70(ddl::Input),
      UTF8Char380B71(ddl::Input),
      UTF8Char380B72(ddl::Input),
      UTF8Char380B73(ddl::Input),
      UTF8Char380B74(ddl::Input),
      UTF8Char380B75(ddl::Input),
      UTF8Char380B76(ddl::Input),
      UTF8Char380B77(ddl::Input),
      UTF8Char380B78(ddl::Input),
      UTF8Char380B79(ddl::Input),
      UTF8Char380B80(ddl::Input),
      UTF8Char380B81(ddl::Input),
      UTF8Char380B82(ddl::Input),
      UTF8Char380B83(ddl::Input),
      UTF8Char380B84(ddl::Input),
      UTF8Char380B85(ddl::Input),
      UTF8Char380B86(ddl::Input),
      UTF8Char380B87(ddl::Input),
      UTF8Char380B88(ddl::Input),
      UTF8Char380B89(ddl::Input),
      UTF8Char380B90(ddl::Input),
      UTF8Char380B91(ddl::Input),
      UTF8Char380B92(ddl::Input),
      UTF8Char380B93(ddl::Input),
      UTF8Char380B94(ddl::Input),
      UTF8Char380B95(ddl::Input),
      UTF8Char380B96(ddl::Input),
      UTF8Char380B97(ddl::Input),
      UTF8Char380B98(ddl::Input),
      UTF8Char380B99(ddl::Input),
      UTF8Char380B100(ddl::Input),
      UTF8Char380B101(ddl::Input),
      UTF8Char380B102(ddl::Input),
      UTF8Char380B103(ddl::Input),
      UTF8Char380B104(ddl::Input),
      UTF8Char380B105(ddl::Input),
      UTF8Char380B106(ddl::Input),
      UTF8Char380B107(ddl::Input),
      UTF8Char380B108(ddl::Input),
      UTF8Char380B109(ddl::Input),
      UTF8Char380B110(ddl::Input),
      UTF8Char380B111(ddl::Input),
      UTF8Char380B112(ddl::Input),
      UTF8Char380B113(ddl::Input),
      UTF8Char380B114(ddl::Input),
      UTF8Char380B115(ddl::Input),
      UTF8Char380B116(ddl::Input),
      UTF8Char380B117(ddl::Input),
      UTF8Char380B118(ddl::Input),
      UTF8Char380B119(ddl::Input),
      UTF8Char380B120(ddl::Input),
      UTF8Char380B121(ddl::Input),
      UTF8Char380B122(ddl::Input),
      UTF8Char380B123(ddl::Input),
      UTF8Char380B124(ddl::Input),
      UTF8Char380B125(ddl::Input),
      UTF8Char380B126(ddl::Input),
      UTF8Char380B127(ddl::Input),
      UTF8Char380B128(ddl::Input),
      UTF8Char380B129(ddl::Input),
      UTF8Char380B130(ddl::Input),
      UTF8Char380B131(bool, ddl::Input, ddl::Input),
      UTF8Char380B132(ddl::Input, ddl::Input),
      UTF8Char380B133(ddl::Input),
      UTF8Char380B134(ddl::Input),
      UTF8Char380B135(ddl::Input),
      UTF8Char380B136(ddl::Input),
      UTF8Char380B137(bool, ddl::Input, ddl::Input),
      UTF8Char380B138(ddl::Input, ddl::Input),
      UTF8Char380B139(ddl::Input),
      UTF8Char380B140(ddl::Input),
      UTF8Char380B141(ddl::Input),
      UTF8Char380B142(ddl::Input),
      UTF8Char380B143(bool, ddl::Input, ddl::Input),
      UTF8Char380B144(ddl::Input, ddl::Input),
      UTF8Char380B145(ddl::Input),
      UTF8Char380B146(ddl::Input),
      UTF8Char380B147(ddl::Input),
      UTF8Char380B148(ddl::Input),
      UTF8Char380B149(bool, ddl::Input, ddl::Input),
      UTF8Char380B150(ddl::Input, ddl::Input),
      UTF8Char380B151(ddl::Input),
      UTF8Char380B152(ddl::Input),
      UTF8Char380B153(ddl::Input),
      UTF8Char380B154(ddl::Input),
      UTF8Char380B155(bool, ddl::Input, ddl::Input),
      UTF8Char380B156(ddl::Input, ddl::Input),
      UTF8Char380B157(ddl::Input),
      UTF8Char380B158(ddl::Input),
      UTF8Char380B159(ddl::Input),
      UTF8Char380B160(ddl::Input),
      UTF8Char380B161(bool, ddl::Input, ddl::Input),
      UTF8Char380B162(ddl::Input, ddl::Input),
      UTF8Char380B163(ddl::Input),
      UTF8Char380B164(ddl::Input),
      UTF8Char380B165(ddl::Input),
      UTF8Char380B166(ddl::Input),
      UTF8Char380B167(bool, ddl::Input, ddl::Input),
      UTF8Char380B168(ddl::Input, ddl::Input),
      UTF8Char380B169(ddl::Input),
      UTF8Char380B170(ddl::Input),
      UTF8Char380B171(ddl::Input),
      UTF8Char380B172(ddl::Input),
      UTF8Char380B173(bool, ddl::Input, ddl::Input),
      UTF8Char380B174(ddl::Input, ddl::Input),
      UTF8Char380B175(ddl::Input),
      UTF8Char380B176(ddl::Input),
      UTF8Char380B177(ddl::Input),
      UTF8Char380B178(ddl::Input),
      UTF8Char380B179(bool, ddl::Input, ddl::Input),
      UTF8Char380B180(ddl::Input, ddl::Input),
      UTF8Char380B181(ddl::Input),
      UTF8Char380B182(ddl::Input),
      UTF8Char380B183(ddl::Input),
      UTF8Char380B184(ddl::Input),
      UTF8Char380B185(bool, ddl::Input, ddl::Input),
      UTF8Char380B186(ddl::Input, ddl::Input),
      UTF8Char380B187(ddl::Input),
      UTF8Char380B188(ddl::Input),
      UTF8Char380B189(ddl::Input),
      UTF8Char380B190(ddl::Input),
      UTF8Char380B191(bool, ddl::Input, ddl::Input),
      UTF8Char380B192(ddl::Input, ddl::Input),
      UTF8Char380B193(ddl::Input),
      UTF8Char380B194(ddl::Input),
      UTF8Char380B195(ddl::Input),
      UTF8Char380B196(ddl::Input),
      UTF8Char380B197(bool, ddl::Input, ddl::Input),
      UTF8Char380B198(ddl::Input, ddl::Input),
      UTF8Char380B199(ddl::Input),
      UTF8Char380B200(ddl::Input),
      UTF8Char380B201(ddl::Input),
      UTF8Char380B202(ddl::Input),
      UTF8Char380B203(bool, ddl::Input, ddl::Input),
      UTF8Char380B204(ddl::Input, ddl::Input),
      UTF8Char380B205(ddl::Input),
      UTF8Char380B206(ddl::Input),
      UTF8Char380B207(ddl::Input),
      UTF8Char380B208(ddl::Input),
      UTF8Char380B209(bool, ddl::Input, ddl::Input),
      UTF8Char380B210(ddl::Input, ddl::Input),
      UTF8Char380B211(ddl::Input),
      UTF8Char380B212(ddl::Input),
      UTF8Char380B213(ddl::Input),
      UTF8Char380B214(ddl::Input),
      UTF8Char380B215(bool, ddl::Input, ddl::Input),
      UTF8Char380B216(ddl::Input, ddl::Input),
      UTF8Char380B217(ddl::Input),
      UTF8Char380B218(ddl::Input),
      UTF8Char380B219(ddl::Input),
      UTF8Char380B220(ddl::Input),
      UTF8Char380B221(bool, ddl::Input, ddl::Input),
      UTF8Char380B222(ddl::Input, ddl::Input),
      UTF8Char380B223(ddl::Input),
      UTF8Char380B224(ddl::Input),
      UTF8Char380B225(ddl::Input),
      UTF8Char380B226(ddl::Input),
      UTF8Char380B227(bool, ddl::Input, ddl::Input),
      UTF8Char380B228(ddl::Input, ddl::Input),
      UTF8Char380B229(ddl::Input),
      UTF8Char380B230(ddl::Input),
      UTF8Char380B231(ddl::Input),
      UTF8Char380B232(ddl::Input),
      UTF8Char380B233(bool, ddl::Input, ddl::Input),
      UTF8Char380B234(ddl::Input, ddl::Input),
      UTF8Char380B235(ddl::Input),
      UTF8Char380B236(ddl::Input),
      UTF8Char380B237(ddl::Input),
      UTF8Char380B238(ddl::Input),
      UTF8Char380B239(bool, ddl::Input, ddl::Input),
      UTF8Char380B240(ddl::Input, ddl::Input),
      UTF8Char380B241(ddl::Input),
      UTF8Char380B242(ddl::Input),
      UTF8Char380B243(ddl::Input),
      UTF8Char380B244(ddl::Input),
      UTF8Char380B245(bool, ddl::Input, ddl::Input),
      UTF8Char380B246(ddl::Input, ddl::Input),
      UTF8Char380B247(ddl::Input),
      UTF8Char380B248(ddl::Input),
      UTF8Char380B249(ddl::Input),
      UTF8Char380B250(ddl::Input),
      UTF8Char380B251(bool, ddl::Input, ddl::Input),
      UTF8Char380B252(ddl::Input, ddl::Input),
      UTF8Char380B253(ddl::Input),
      UTF8Char380B254(ddl::Input),
      UTF8Char380B255(ddl::Input),
      UTF8Char380B256(ddl::Input),
      UTF8Char380B257(bool, ddl::Input, ddl::Input),
      UTF8Char380B258(ddl::Input, ddl::Input),
      UTF8Char380B259(ddl::Input),
      UTF8Char380B260(ddl::Input),
      UTF8Char380B261(ddl::Input),
      UTF8Char380B262(ddl::Input),
      UTF8Char380B263(bool, ddl::Input, ddl::Input),
      UTF8Char380B264(ddl::Input, ddl::Input),
      UTF8Char380B265(ddl::Input),
      UTF8Char380B266(ddl::Input),
      UTF8Char380B267(ddl::Input),
      UTF8Char380B268(ddl::Input),
      UTF8Char380B269(bool, ddl::Input, ddl::Input),
      UTF8Char380B270(ddl::Input, ddl::Input),
      UTF8Char380B271(ddl::Input),
      UTF8Char380B272(ddl::Input),
      UTF8Char380B273(ddl::Input),
      UTF8Char380B274(ddl::Input),
      UTF8Char380B275(bool, ddl::Input, ddl::Input),
      UTF8Char380B276(ddl::Input, ddl::Input),
      UTF8Char380B277(ddl::Input),
      UTF8Char380B278(ddl::Input),
      UTF8Char380B279(ddl::Input),
      UTF8Char380B280(ddl::Input),
      UTF8Char380B281(bool, ddl::Input, ddl::Input),
      UTF8Char380B282(ddl::Input, ddl::Input),
      UTF8Char380B283(ddl::Input),
      UTF8Char380B284(ddl::Input),
      UTF8Char380B285(ddl::Input),
      UTF8Char380B286(ddl::Input),
      UTF8Char380B287(bool, ddl::Input, ddl::Input),
      UTF8Char380B288(ddl::Input, ddl::Input),
      UTF8Char380B289(ddl::Input),
      UTF8Char380B290(ddl::Input),
      UTF8Char380B291(ddl::Input),
      UTF8Char380B292(ddl::Input),
      UTF8Char380B293(bool, ddl::Input, ddl::Input),
      UTF8Char380B294(ddl::Input, ddl::Input),
      UTF8Char380B295(ddl::Input),
      UTF8Char380B296(ddl::Input),
      UTF8Char380B297(ddl::Input),
      UTF8Char380B298(ddl::Input),
      UTF8Char380B299(bool, ddl::Input, ddl::Input),
      UTF8Char380B300(ddl::Input, ddl::Input),
      UTF8Char380B301(ddl::Input),
      UTF8Char380B302(ddl::Input),
      UTF8Char380B303(ddl::Input),
      UTF8Char380B304(ddl::Input),
      UTF8Char380B305(bool, ddl::Input, ddl::Input),
      UTF8Char380B306(ddl::Input, ddl::Input),
      UTF8Char380B307(ddl::Input),
      UTF8Char380B308(ddl::Input),
      UTF8Char380B309(ddl::Input),
      UTF8Char380B310(ddl::Input),
      UTF8Char380B311(bool, ddl::Input, ddl::Input),
      UTF8Char380B312(ddl::Input, ddl::Input),
      UTF8Char380B314(ddl::Input),
      UTF8Char380B316(ddl::Input),
      UTF8Char380B317(ddl::Input),
      UTF8Char380B318(ddl::Input, bool, ddl::Input),
      UTF8Char380B319(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char380B320(ddl::Input, ddl::Input),
      UTF8Char380B321(ddl::Input, ddl::Input),
      UTF8Char380B322(ddl::Input),
      UTF8Char380B323(ddl::Input),
      UTF8Char380B324(ddl::Input),
      UTF8Char380B325(ddl::Input),
      UTF8Char380B326(bool, ddl::Input, ddl::Input),
      UTF8Char380B327(ddl::Input, ddl::Input),
      UTF8Char380B329(ddl::Input),
      UTF8Char380B331(ddl::Input),
      UTF8Char380B332(ddl::Input),
      UTF8Char380B333(bool, ddl::Input, ddl::Input),
      UTF8Char380B334(ddl::Input, ddl::Input),
      UTF8Char380B335(ddl::Input),
      UTF8Char380B336(ddl::Input),
      UTF8Char380B337(ddl::Input),
      UTF8Char380B338(ddl::Input),
      UTF8Char380B339(bool, ddl::Input, ddl::Input),
      UTF8Char380B340(ddl::Input, ddl::Input),
      UTF8Char380B342(ddl::Input),
      UTF8Char380B344(ddl::Input),
      UTF8Char380B345(ddl::Input),
      UTF8Char380B346(bool, ddl::Input, ddl::Input),
      UTF8Char380B347(ddl::Input, ddl::Input),
      UTF8Char380B348(ddl::Input),
      UTF8Char380B349(ddl::Input),
      UTF8Char380B350(ddl::Input),
      UTF8Char380B351(ddl::Input),
      UTF8Char380B352(bool, ddl::Input, ddl::Input),
      UTF8Char380B353(ddl::Input, ddl::Input),
      UTF8Char380B355(ddl::Input),
      UTF8Char380B357(ddl::Input),
      UTF8Char380B358(ddl::Input),
      UTF8Char380B359(bool, ddl::Input, ddl::Input),
      UTF8Char380B360(ddl::Input, ddl::Input),
      UTF8Char380B361(ddl::Input),
      UTF8Char380B362(ddl::Input),
      UTF8Char380B363(ddl::Input),
      UTF8Char380B364(ddl::Input),
      UTF8Char380B365(bool, ddl::Input, ddl::Input),
      UTF8Char380B366(ddl::Input, ddl::Input),
      UTF8Char380B368(ddl::Input),
      UTF8Char380B370(ddl::Input),
      UTF8Char380B371(ddl::Input),
      UTF8Char380B372(bool, ddl::Input, ddl::Input),
      UTF8Char380B373(ddl::Input, ddl::Input),
      UTF8Char380B374(ddl::Input),
      UTF8Char380B375(ddl::Input),
      UTF8Char380B376(ddl::Input),
      UTF8Char380B377(ddl::Input),
      UTF8Char380B378(bool, ddl::Input, ddl::Input),
      UTF8Char380B379(ddl::Input, ddl::Input),
      UTF8Char380B381(ddl::Input),
      UTF8Char380B383(ddl::Input),
      UTF8Char380B384(ddl::Input),
      UTF8Char380B385(bool, ddl::Input, ddl::Input),
      UTF8Char380B386(ddl::Input, ddl::Input),
      UTF8Char380B387(ddl::Input),
      UTF8Char380B388(ddl::Input),
      UTF8Char380B389(ddl::Input),
      UTF8Char380B390(ddl::Input),
      UTF8Char380B391(bool, ddl::Input, ddl::Input),
      UTF8Char380B392(ddl::Input, ddl::Input),
      UTF8Char380B394(ddl::Input),
      UTF8Char380B396(ddl::Input),
      UTF8Char380B397(ddl::Input),
      UTF8Char380B398(bool, ddl::Input, ddl::Input),
      UTF8Char380B399(ddl::Input, ddl::Input),
      UTF8Char380B400(ddl::Input),
      UTF8Char380B401(ddl::Input),
      UTF8Char380B402(ddl::Input),
      UTF8Char380B403(ddl::Input),
      UTF8Char380B404(bool, ddl::Input, ddl::Input),
      UTF8Char380B405(ddl::Input, ddl::Input),
      UTF8Char380B407(ddl::Input),
      UTF8Char380B409(ddl::Input),
      UTF8Char380B410(ddl::Input),
      UTF8Char380B411(bool, ddl::Input, ddl::Input),
      UTF8Char380B412(ddl::Input, ddl::Input),
      UTF8Char380B413(ddl::Input),
      UTF8Char380B414(ddl::Input),
      UTF8Char380B415(ddl::Input),
      UTF8Char380B416(ddl::Input),
      UTF8Char380B417(bool, ddl::Input, ddl::Input),
      UTF8Char380B418(ddl::Input, ddl::Input),
      UTF8Char380B420(ddl::Input),
      UTF8Char380B422(ddl::Input),
      UTF8Char380B423(ddl::Input),
      UTF8Char380B424(bool, ddl::Input, ddl::Input),
      UTF8Char380B425(ddl::Input, ddl::Input),
      UTF8Char380B426(ddl::Input),
      UTF8Char380B427(ddl::Input),
      UTF8Char380B428(ddl::Input),
      UTF8Char380B429(ddl::Input),
      UTF8Char380B430(bool, ddl::Input, ddl::Input),
      UTF8Char380B431(ddl::Input, ddl::Input),
      UTF8Char380B433(ddl::Input),
      UTF8Char380B435(ddl::Input),
      UTF8Char380B436(ddl::Input),
      UTF8Char380B437(bool, ddl::Input, ddl::Input),
      UTF8Char380B438(ddl::Input, ddl::Input),
      UTF8Char380B439(ddl::Input),
      UTF8Char380B440(ddl::Input),
      UTF8Char380B441(ddl::Input),
      UTF8Char380B442(ddl::Input),
      UTF8Char380B443(bool, ddl::Input, ddl::Input),
      UTF8Char380B444(ddl::Input, ddl::Input),
      UTF8Char380B446(ddl::Input),
      UTF8Char380B448(ddl::Input),
      UTF8Char380B449(ddl::Input),
      UTF8Char380B450(bool, ddl::Input, ddl::Input),
      UTF8Char380B451(ddl::Input, ddl::Input),
      UTF8Char380B452(ddl::Input),
      UTF8Char380B453(ddl::Input),
      UTF8Char380B454(ddl::Input),
      UTF8Char380B455(ddl::Input),
      UTF8Char380B456(bool, ddl::Input, ddl::Input),
      UTF8Char380B457(ddl::Input, ddl::Input),
      UTF8Char380B459(ddl::Input),
      UTF8Char380B461(ddl::Input),
      UTF8Char380B462(ddl::Input),
      UTF8Char380B463(bool, ddl::Input, ddl::Input),
      UTF8Char380B464(ddl::Input, ddl::Input),
      UTF8Char380B465(ddl::Input),
      UTF8Char380B466(ddl::Input),
      UTF8Char380B467(ddl::Input),
      UTF8Char380B468(ddl::Input),
      UTF8Char380B469(bool, ddl::Input, ddl::Input),
      UTF8Char380B470(ddl::Input, ddl::Input),
      UTF8Char380B472(ddl::Input),
      UTF8Char380B474(ddl::Input),
      UTF8Char380B475(ddl::Input),
      UTF8Char380B476(bool, ddl::Input, ddl::Input),
      UTF8Char380B477(ddl::Input, ddl::Input),
      UTF8Char380B478(ddl::Input),
      UTF8Char380B479(ddl::Input),
      UTF8Char380B480(ddl::Input),
      UTF8Char380B481(ddl::Input),
      UTF8Char380B482(bool, ddl::Input, ddl::Input),
      UTF8Char380B483(ddl::Input, ddl::Input),
      UTF8Char380B485(ddl::Input),
      UTF8Char380B487(ddl::Input),
      UTF8Char380B488(ddl::Input),
      UTF8Char380B489(bool, ddl::Input, ddl::Input),
      UTF8Char380B490(ddl::Input, ddl::Input),
      UTF8Char380B491(ddl::Input),
      UTF8Char380B492(ddl::Input),
      UTF8Char380B493(ddl::Input),
      UTF8Char380B494(ddl::Input),
      UTF8Char380B495(bool, ddl::Input, ddl::Input),
      UTF8Char380B496(ddl::Input, ddl::Input),
      UTF8Char380B498(ddl::Input),
      UTF8Char380B500(ddl::Input),
      UTF8Char380B501(ddl::Input),
      UTF8Char380B502(bool, ddl::Input, ddl::Input),
      UTF8Char380B503(ddl::Input, ddl::Input),
      UTF8Char380B504(ddl::Input),
      UTF8Char380B505(ddl::Input),
      UTF8Char380B506(ddl::Input),
      UTF8Char380B507(ddl::Input),
      UTF8Char380B508(bool, ddl::Input, ddl::Input),
      UTF8Char380B509(ddl::Input, ddl::Input),
      UTF8Char380B511(ddl::Input),
      UTF8Char380B513(ddl::Input),
      UTF8Char380B514(ddl::Input),
      UTF8Char380B515(ddl::Input, bool, ddl::Input),
      UTF8Char380B516(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char380B517(ddl::Input, ddl::Input),
      UTF8Char380B518(ddl::Input, ddl::Input),
      UTF8Char380B519(ddl::Input),
      UTF8Char380B520(ddl::Input),
      UTF8Char380B521(ddl::Input),
      UTF8Char380B522(ddl::Input),
      UTF8Char380B523(bool, ddl::Input, ddl::Input),
      UTF8Char380B524(ddl::Input, ddl::Input),
      UTF8Char380B526(ddl::Input),
      UTF8Char380B528(ddl::Input),
      UTF8Char380B529(ddl::Input),
      UTF8Char380B530(bool, ddl::Input, ddl::Input),
      UTF8Char380B531(ddl::Input, ddl::Input),
      UTF8Char380B533(ddl::Input),
      UTF8Char380B535(ddl::Input),
      UTF8Char380B536(ddl::Input),
      UTF8Char380B537(ddl::Input, bool, ddl::Input),
      UTF8Char380B538(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char380B539(ddl::Input, ddl::Input),
      UTF8Char380B540(ddl::Input, ddl::Input),
      UTF8Char380B541(ddl::Input),
      UTF8Char380B542(ddl::Input),
      UTF8Char380B543(ddl::Input),
      UTF8Char380B544(ddl::Input),
      UTF8Char380B545(bool, ddl::Input, ddl::Input),
      UTF8Char380B546(ddl::Input, ddl::Input),
      UTF8Char380B548(ddl::Input),
      UTF8Char380B550(ddl::Input),
      UTF8Char380B551(ddl::Input),
      UTF8Char380B552(bool, ddl::Input, ddl::Input),
      UTF8Char380B553(ddl::Input, ddl::Input),
      UTF8Char380B555(ddl::Input),
      UTF8Char380B557(ddl::Input),
      UTF8Char380B558(ddl::Input),
      UTF8Char380B559(bool, ddl::Input, ddl::Input),
      UTF8Char380B560(ddl::Input, ddl::Input),
      UTF8Char380B561(ddl::Input),
      UTF8Char380B562(ddl::Input),
      UTF8Char380B563(ddl::Input),
      UTF8Char380B564(ddl::Input),
      UTF8Char380B565(bool, ddl::Input, ddl::Input),
      UTF8Char380B566(ddl::Input, ddl::Input),
      UTF8Char380B568(ddl::Input),
      UTF8Char380B570(ddl::Input),
      UTF8Char380B571(ddl::Input),
      UTF8Char380B572(bool, ddl::Input, ddl::Input),
      UTF8Char380B573(ddl::Input, ddl::Input),
      UTF8Char380B575(ddl::Input),
      UTF8Char380B577(ddl::Input),
      UTF8Char380B578(ddl::Input),
      UTF8Char380B579(bool, ddl::Input, ddl::Input),
      UTF8Char380B580(ddl::Input, ddl::Input),
      UTF8Char380B581(ddl::Input),
      UTF8Char380B582(ddl::Input),
      UTF8Char380B583(ddl::Input),
      UTF8Char380B584(ddl::Input),
      UTF8Char380B585(bool, ddl::Input, ddl::Input),
      UTF8Char380B586(ddl::Input, ddl::Input),
      UTF8Char380B588(ddl::Input),
      UTF8Char380B590(ddl::Input),
      UTF8Char380B591(ddl::Input),
      UTF8Char380B592(bool, ddl::Input, ddl::Input),
      UTF8Char380B593(ddl::Input, ddl::Input),
      UTF8Char380B595(ddl::Input),
      UTF8Char380B597(ddl::Input),
      UTF8Char380B598(ddl::Input),
      UTF8Char380B599(bool, ddl::Input, ddl::Input),
      UTF8Char380B600(ddl::Input, ddl::Input),
      UTF8Char380B601(ddl::Input),
      UTF8Char380B602(ddl::Input),
      UTF8Char380B603(ddl::Input),
      UTF8Char380B604(ddl::Input),
      UTF8Char380B605(bool, ddl::Input, ddl::Input),
      UTF8Char380B606(ddl::Input, ddl::Input),
      UTF8Char380B608(ddl::Input),
      UTF8Char380B610(ddl::Input),
      UTF8Char380B611(ddl::Input),
      UTF8Char380B612(bool, ddl::Input, ddl::Input),
      UTF8Char380B613(ddl::Input, ddl::Input),
      UTF8Char380B615(ddl::Input),
      UTF8Char380B617(ddl::Input),
      UTF8Char380B618(ddl::Input),
      UTF8Char380B619(ddl::Input, bool, ddl::Input),
      UTF8Char380B620(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char380B621(ddl::Input, ddl::Input),
      UTF8Char380B622(ddl::Input, ddl::Input),
      UTF8Char380B623(ddl::Input),
      UTF8Char380B624(ddl::Input),
      UTF8Char380B626(ddl::Input),
      UTF8Char380B628(ddl::Input, ddl::U<8>),
      UTF8Char380B629(ddl::Input),
      UTF8Char380B630(ddl::Input, ddl::Input),
      UTF8Char380B631(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UTF8Char380B631(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::UTF8Char380B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B1(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B2(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B3(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B4(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B5(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B6(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B7(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B8(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B9(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B10(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B11(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B12(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B13(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B14(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B15(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B16(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B17(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B18(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B19(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B20(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B21(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B22(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B23(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B24(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B25(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B26(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B27(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B28(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B29(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B30(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B31(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B32(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B33(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B34(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B35(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B36(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B37(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B38(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B39(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B40(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B41(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B42(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B43(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B44(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B45(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B46(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B47(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B48(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B49(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B50(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B51(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B52(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B53(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B54(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B55(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B56(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B57(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B58(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B59(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B60(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B61(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B62(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B63(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B64(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B65(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B66(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B67(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B68(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B69(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B70(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B71(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B72(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B73(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B74(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B75(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B76(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B77(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B78(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B79(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B80(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B81(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B82(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B83(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B84(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B85(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B86(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B87(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B88(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B89(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B90(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B91(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B92(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B93(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B94(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B95(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B96(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B97(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B98(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B99(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B100(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B101(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B102(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B103(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B104(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B105(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B106(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B107(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B108(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B109(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B110(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B111(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B112(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B113(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B114(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B115(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B116(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B117(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B118(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B119(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B120(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B121(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B122(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B123(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B124(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B125(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B126(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B127(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char380B128(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B129(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B130(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B131(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B130(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B129(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B132(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B131(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B133(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B132(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B128(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B134(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B135(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B136(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B137(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B136(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B135(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B138(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B137(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B139(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B138(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B134(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B140(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B141(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B142(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B143(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B142(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B141(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B144(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B143(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B145(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B144(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B140(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B146(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B147(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B148(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B149(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B148(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B147(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B150(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B149(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B151(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B150(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B146(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B152(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B153(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B154(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B155(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B154(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B153(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B156(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B155(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B157(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B156(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B152(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B158(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B159(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B160(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B161(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B160(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B159(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B162(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B161(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B163(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B162(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B158(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B164(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B165(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B166(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B167(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B166(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B165(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B168(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B167(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B169(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B168(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B164(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B170(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B171(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B172(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B173(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B172(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B171(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B174(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B173(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B175(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B174(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B170(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B176(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B177(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B178(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B179(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B178(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B177(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B180(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B179(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B181(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B180(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B176(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B182(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B183(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B184(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B185(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B184(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B183(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B186(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B185(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B187(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B186(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B182(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B188(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B189(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B190(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B191(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B190(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B189(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B192(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B191(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B193(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B192(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B188(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B194(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B195(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B196(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B197(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B196(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B195(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B198(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B197(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B199(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B198(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B194(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B200(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B201(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B202(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B203(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B202(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B201(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B204(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B203(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B205(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B204(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B200(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B206(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B207(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B208(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B209(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B208(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B207(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B210(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B209(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B211(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B210(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B206(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B212(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B213(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B214(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B215(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B214(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B213(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B216(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B215(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B217(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B216(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B212(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B218(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B219(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B220(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B221(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B220(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B219(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B222(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B221(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B223(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B222(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B218(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B224(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B225(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B226(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B227(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B226(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B225(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B228(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B227(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B229(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B228(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B224(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B230(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B231(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B232(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B233(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B232(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B231(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B234(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B233(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B235(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B234(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B230(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B236(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B237(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B238(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B239(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B238(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B237(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B240(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B239(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B241(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B240(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B236(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B242(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B243(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B244(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B245(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B244(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B243(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B246(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B245(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B247(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B246(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B242(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B248(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B249(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B250(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B251(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B250(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B249(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B252(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B251(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B253(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B252(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B248(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B254(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B255(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B256(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B257(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B256(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B255(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B258(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B257(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B259(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B258(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B254(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B260(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B261(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B262(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B263(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B262(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B261(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B264(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B263(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B265(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B264(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B260(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B266(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B267(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B268(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B269(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B268(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B267(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B270(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B269(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B271(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B270(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B266(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B272(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B273(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B274(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B275(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B274(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B273(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B276(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B275(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B277(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B276(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B272(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B278(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B279(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B280(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B281(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B280(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B279(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B282(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B281(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B283(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B282(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B278(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B284(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B285(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B286(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B287(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B286(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B285(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B288(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B287(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B289(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B288(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B284(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B290(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B291(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B292(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B293(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B292(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B291(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B294(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B293(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B295(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B294(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B290(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B296(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B297(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B298(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B299(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B298(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B297(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B300(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B299(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B301(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B300(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B296(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B302(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B303(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B304(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B305(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B304(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B303(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B306(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B305(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B307(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B306(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B302(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B308(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:36--82:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B309(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B310(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:36--82:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B311(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B310(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B309(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B312(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B311(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B314(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:18--82:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B316(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B312(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B308(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B317(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:18--82:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B318(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B317(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B316(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B319(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          block_id = Goto::UTF8Char380B318(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char380B320(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char380B318(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char380B321(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(160u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B320(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B319(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B322(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B321(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B314(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B323(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B324(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B325(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B326(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B325(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B324(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B327(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B326(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B329(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B331(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B327(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B323(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B332(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B333(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B332(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B331(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B334(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B333(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B335(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B334(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B329(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B336(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B337(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B338(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B339(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B338(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B337(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B340(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B339(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B342(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B344(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B340(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B336(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B345(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B346(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B345(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B344(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B347(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B346(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B348(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B347(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B342(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B349(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B350(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B351(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B352(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B351(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B350(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B353(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B352(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B355(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B357(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B353(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B349(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B358(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B359(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B358(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B357(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B360(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B359(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B361(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B360(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B355(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B362(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B363(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B364(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B365(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B364(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B363(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B366(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B365(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B368(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B370(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B366(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B362(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B371(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B372(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B371(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B370(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B373(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B372(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B374(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B373(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B368(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B375(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B376(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B377(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B378(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B377(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B376(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B379(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B378(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B381(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B383(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B379(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B375(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B384(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B385(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B384(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B383(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B386(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B385(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B387(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B386(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B381(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B388(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B389(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B390(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B391(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B390(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B389(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B392(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B391(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B394(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B396(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B392(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B388(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B397(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B398(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B397(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B396(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B399(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B398(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B400(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B399(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B394(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B401(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B402(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B403(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B404(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B403(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B402(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B405(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B404(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B407(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B409(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B405(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B401(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B410(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B411(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B410(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B409(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B412(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B411(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B413(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B412(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B407(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B414(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B415(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B416(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B417(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B416(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B415(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B418(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B417(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B420(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B422(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B418(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B414(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B423(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B424(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B423(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B422(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B425(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B424(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B426(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B425(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B420(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B427(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B428(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B429(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B430(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B429(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B428(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B431(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B430(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B433(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B435(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B431(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B427(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B436(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B437(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B436(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B435(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B438(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B437(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B439(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B438(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B433(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B440(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B441(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B442(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B443(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B442(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B441(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B444(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B443(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B446(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B448(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B444(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B440(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B449(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B450(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B449(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B448(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B451(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B450(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B452(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B451(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B446(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B453(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B454(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B455(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B456(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B455(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B454(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B457(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B456(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B459(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B461(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B457(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B453(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B462(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B463(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B462(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B461(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B464(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B463(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B465(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B464(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B459(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B466(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B467(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B468(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B469(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B468(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B467(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B470(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B469(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B472(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B474(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B470(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B466(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B475(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B476(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B475(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B474(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B477(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B476(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B478(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B477(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B472(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B479(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B480(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B481(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B482(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B481(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B480(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B483(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B482(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B485(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B487(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B483(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B479(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B488(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B489(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B488(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B487(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B490(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B489(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B491(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B490(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B485(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B492(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B493(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B494(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B495(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B494(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B493(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B496(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B495(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B498(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B500(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B496(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B492(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B501(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B502(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B501(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B500(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B503(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B502(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B504(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B503(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B498(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B505(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:36--84:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B506(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B507(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:36--84:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B508(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B507(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B506(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B509(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B508(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B511(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:18--84:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B513(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B509(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B505(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B514(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:18--84:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B515(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B514(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B513(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B516(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(159u64);
          block_id = Goto::UTF8Char380B515(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char380B517(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char380B515(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char380B518(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(128u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B517(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B516(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B519(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B518(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B511(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B520(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:51--85:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B521(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B522(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:51--85:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B523(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B522(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B521(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B524(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B523(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B526(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:36--85:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B528(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B524(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B520(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B529(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:36--85:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B530(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B529(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B528(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B531(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B530(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B533(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:18--85:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B535(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B531(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B526(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B536(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:18--85:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B537(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B536(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B535(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B538(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          block_id = Goto::UTF8Char380B537(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char380B539(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char380B537(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char380B540(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(144u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B539(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B538(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B541(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B540(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B533(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B542(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B543(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B544(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B545(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B544(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B543(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B546(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B545(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B548(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B550(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B546(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B542(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B551(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B552(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B551(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B550(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B553(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B552(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B555(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B557(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B553(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B548(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B558(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B559(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B558(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B557(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B560(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B559(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B561(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B560(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B555(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B562(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B563(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B564(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B565(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B564(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B563(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B566(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B565(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B568(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B570(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B566(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B562(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B571(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B572(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B571(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B570(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B573(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B572(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B575(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B577(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B573(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B568(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B578(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B579(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B578(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B577(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B580(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B579(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B581(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B580(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B575(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B582(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B583(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B584(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B585(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B584(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B583(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B586(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B585(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B588(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B590(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B586(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B582(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B591(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B592(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B591(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B590(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B593(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B592(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B595(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B597(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B593(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B588(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B598(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B599(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B598(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B597(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B600(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B599(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B601(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B600(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B595(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B602(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:51--87:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B603(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char380B604(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:51--87:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B605(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B604(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B603(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B606(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B605(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B608(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:36--87:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B610(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B606(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B602(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B611(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:36--87:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B612(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B611(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B610(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B613(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char380B612(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char380B615(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:18--87:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B617(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B613(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B608(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B618(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:18--87:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B619(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char380B618(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B617(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B620(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(143u64);
          block_id = Goto::UTF8Char380B619(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char380B621(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char380B619(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char380B622(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(128u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char380B621(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B620(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B623(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B622(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B615(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B624(_arg_0) => {
          let _tmp_0: ddl::Array<ddl::U<8>> = ddl::new_byte_array(b"");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B626(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B628(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          match _arg_1.into() {
            0u8 => {
              block_id = Goto::UTF8Char380B0(_tmp_0);
              continue '_fun_loop
            },
            1u8 => {
              block_id = Goto::UTF8Char380B1(_tmp_0);
              continue '_fun_loop
            },
            2u8 => {
              block_id = Goto::UTF8Char380B2(_tmp_0);
              continue '_fun_loop
            },
            3u8 => {
              block_id = Goto::UTF8Char380B3(_tmp_0);
              continue '_fun_loop
            },
            4u8 => {
              block_id = Goto::UTF8Char380B4(_tmp_0);
              continue '_fun_loop
            },
            5u8 => {
              block_id = Goto::UTF8Char380B5(_tmp_0);
              continue '_fun_loop
            },
            6u8 => {
              block_id = Goto::UTF8Char380B6(_tmp_0);
              continue '_fun_loop
            },
            7u8 => {
              block_id = Goto::UTF8Char380B7(_tmp_0);
              continue '_fun_loop
            },
            8u8 => {
              block_id = Goto::UTF8Char380B8(_tmp_0);
              continue '_fun_loop
            },
            9u8 => {
              block_id = Goto::UTF8Char380B9(_tmp_0);
              continue '_fun_loop
            },
            10u8 => {
              block_id = Goto::UTF8Char380B10(_tmp_0);
              continue '_fun_loop
            },
            11u8 => {
              block_id = Goto::UTF8Char380B11(_tmp_0);
              continue '_fun_loop
            },
            12u8 => {
              block_id = Goto::UTF8Char380B12(_tmp_0);
              continue '_fun_loop
            },
            13u8 => {
              block_id = Goto::UTF8Char380B13(_tmp_0);
              continue '_fun_loop
            },
            14u8 => {
              block_id = Goto::UTF8Char380B14(_tmp_0);
              continue '_fun_loop
            },
            15u8 => {
              block_id = Goto::UTF8Char380B15(_tmp_0);
              continue '_fun_loop
            },
            16u8 => {
              block_id = Goto::UTF8Char380B16(_tmp_0);
              continue '_fun_loop
            },
            17u8 => {
              block_id = Goto::UTF8Char380B17(_tmp_0);
              continue '_fun_loop
            },
            18u8 => {
              block_id = Goto::UTF8Char380B18(_tmp_0);
              continue '_fun_loop
            },
            19u8 => {
              block_id = Goto::UTF8Char380B19(_tmp_0);
              continue '_fun_loop
            },
            20u8 => {
              block_id = Goto::UTF8Char380B20(_tmp_0);
              continue '_fun_loop
            },
            21u8 => {
              block_id = Goto::UTF8Char380B21(_tmp_0);
              continue '_fun_loop
            },
            22u8 => {
              block_id = Goto::UTF8Char380B22(_tmp_0);
              continue '_fun_loop
            },
            23u8 => {
              block_id = Goto::UTF8Char380B23(_tmp_0);
              continue '_fun_loop
            },
            24u8 => {
              block_id = Goto::UTF8Char380B24(_tmp_0);
              continue '_fun_loop
            },
            25u8 => {
              block_id = Goto::UTF8Char380B25(_tmp_0);
              continue '_fun_loop
            },
            26u8 => {
              block_id = Goto::UTF8Char380B26(_tmp_0);
              continue '_fun_loop
            },
            27u8 => {
              block_id = Goto::UTF8Char380B27(_tmp_0);
              continue '_fun_loop
            },
            28u8 => {
              block_id = Goto::UTF8Char380B28(_tmp_0);
              continue '_fun_loop
            },
            29u8 => {
              block_id = Goto::UTF8Char380B29(_tmp_0);
              continue '_fun_loop
            },
            30u8 => {
              block_id = Goto::UTF8Char380B30(_tmp_0);
              continue '_fun_loop
            },
            31u8 => {
              block_id = Goto::UTF8Char380B31(_tmp_0);
              continue '_fun_loop
            },
            32u8 => {
              block_id = Goto::UTF8Char380B32(_tmp_0);
              continue '_fun_loop
            },
            33u8 => {
              block_id = Goto::UTF8Char380B33(_tmp_0);
              continue '_fun_loop
            },
            34u8 => {
              block_id = Goto::UTF8Char380B34(_tmp_0);
              continue '_fun_loop
            },
            35u8 => {
              block_id = Goto::UTF8Char380B35(_tmp_0);
              continue '_fun_loop
            },
            36u8 => {
              block_id = Goto::UTF8Char380B36(_tmp_0);
              continue '_fun_loop
            },
            37u8 => {
              block_id = Goto::UTF8Char380B37(_tmp_0);
              continue '_fun_loop
            },
            38u8 => {
              block_id = Goto::UTF8Char380B38(_tmp_0);
              continue '_fun_loop
            },
            39u8 => {
              block_id = Goto::UTF8Char380B39(_tmp_0);
              continue '_fun_loop
            },
            40u8 => {
              block_id = Goto::UTF8Char380B40(_tmp_0);
              continue '_fun_loop
            },
            41u8 => {
              block_id = Goto::UTF8Char380B41(_tmp_0);
              continue '_fun_loop
            },
            42u8 => {
              block_id = Goto::UTF8Char380B42(_tmp_0);
              continue '_fun_loop
            },
            43u8 => {
              block_id = Goto::UTF8Char380B43(_tmp_0);
              continue '_fun_loop
            },
            44u8 => {
              block_id = Goto::UTF8Char380B44(_tmp_0);
              continue '_fun_loop
            },
            45u8 => {
              block_id = Goto::UTF8Char380B45(_tmp_0);
              continue '_fun_loop
            },
            46u8 => {
              block_id = Goto::UTF8Char380B46(_tmp_0);
              continue '_fun_loop
            },
            47u8 => {
              block_id = Goto::UTF8Char380B47(_tmp_0);
              continue '_fun_loop
            },
            48u8 => {
              block_id = Goto::UTF8Char380B48(_tmp_0);
              continue '_fun_loop
            },
            49u8 => {
              block_id = Goto::UTF8Char380B49(_tmp_0);
              continue '_fun_loop
            },
            50u8 => {
              block_id = Goto::UTF8Char380B50(_tmp_0);
              continue '_fun_loop
            },
            51u8 => {
              block_id = Goto::UTF8Char380B51(_tmp_0);
              continue '_fun_loop
            },
            52u8 => {
              block_id = Goto::UTF8Char380B52(_tmp_0);
              continue '_fun_loop
            },
            53u8 => {
              block_id = Goto::UTF8Char380B53(_tmp_0);
              continue '_fun_loop
            },
            54u8 => {
              block_id = Goto::UTF8Char380B54(_tmp_0);
              continue '_fun_loop
            },
            55u8 => {
              block_id = Goto::UTF8Char380B55(_tmp_0);
              continue '_fun_loop
            },
            56u8 => {
              block_id = Goto::UTF8Char380B56(_tmp_0);
              continue '_fun_loop
            },
            57u8 => {
              block_id = Goto::UTF8Char380B57(_tmp_0);
              continue '_fun_loop
            },
            58u8 => {
              block_id = Goto::UTF8Char380B58(_tmp_0);
              continue '_fun_loop
            },
            59u8 => {
              block_id = Goto::UTF8Char380B59(_tmp_0);
              continue '_fun_loop
            },
            60u8 => {
              block_id = Goto::UTF8Char380B60(_tmp_0);
              continue '_fun_loop
            },
            61u8 => {
              block_id = Goto::UTF8Char380B61(_tmp_0);
              continue '_fun_loop
            },
            62u8 => {
              block_id = Goto::UTF8Char380B62(_tmp_0);
              continue '_fun_loop
            },
            63u8 => {
              block_id = Goto::UTF8Char380B63(_tmp_0);
              continue '_fun_loop
            },
            64u8 => {
              block_id = Goto::UTF8Char380B64(_tmp_0);
              continue '_fun_loop
            },
            65u8 => {
              block_id = Goto::UTF8Char380B65(_tmp_0);
              continue '_fun_loop
            },
            66u8 => {
              block_id = Goto::UTF8Char380B66(_tmp_0);
              continue '_fun_loop
            },
            67u8 => {
              block_id = Goto::UTF8Char380B67(_tmp_0);
              continue '_fun_loop
            },
            68u8 => {
              block_id = Goto::UTF8Char380B68(_tmp_0);
              continue '_fun_loop
            },
            69u8 => {
              block_id = Goto::UTF8Char380B69(_tmp_0);
              continue '_fun_loop
            },
            70u8 => {
              block_id = Goto::UTF8Char380B70(_tmp_0);
              continue '_fun_loop
            },
            71u8 => {
              block_id = Goto::UTF8Char380B71(_tmp_0);
              continue '_fun_loop
            },
            72u8 => {
              block_id = Goto::UTF8Char380B72(_tmp_0);
              continue '_fun_loop
            },
            73u8 => {
              block_id = Goto::UTF8Char380B73(_tmp_0);
              continue '_fun_loop
            },
            74u8 => {
              block_id = Goto::UTF8Char380B74(_tmp_0);
              continue '_fun_loop
            },
            75u8 => {
              block_id = Goto::UTF8Char380B75(_tmp_0);
              continue '_fun_loop
            },
            76u8 => {
              block_id = Goto::UTF8Char380B76(_tmp_0);
              continue '_fun_loop
            },
            77u8 => {
              block_id = Goto::UTF8Char380B77(_tmp_0);
              continue '_fun_loop
            },
            78u8 => {
              block_id = Goto::UTF8Char380B78(_tmp_0);
              continue '_fun_loop
            },
            79u8 => {
              block_id = Goto::UTF8Char380B79(_tmp_0);
              continue '_fun_loop
            },
            80u8 => {
              block_id = Goto::UTF8Char380B80(_tmp_0);
              continue '_fun_loop
            },
            81u8 => {
              block_id = Goto::UTF8Char380B81(_tmp_0);
              continue '_fun_loop
            },
            82u8 => {
              block_id = Goto::UTF8Char380B82(_tmp_0);
              continue '_fun_loop
            },
            83u8 => {
              block_id = Goto::UTF8Char380B83(_tmp_0);
              continue '_fun_loop
            },
            84u8 => {
              block_id = Goto::UTF8Char380B84(_tmp_0);
              continue '_fun_loop
            },
            85u8 => {
              block_id = Goto::UTF8Char380B85(_tmp_0);
              continue '_fun_loop
            },
            86u8 => {
              block_id = Goto::UTF8Char380B86(_tmp_0);
              continue '_fun_loop
            },
            87u8 => {
              block_id = Goto::UTF8Char380B87(_tmp_0);
              continue '_fun_loop
            },
            88u8 => {
              block_id = Goto::UTF8Char380B88(_tmp_0);
              continue '_fun_loop
            },
            89u8 => {
              block_id = Goto::UTF8Char380B89(_tmp_0);
              continue '_fun_loop
            },
            90u8 => {
              block_id = Goto::UTF8Char380B90(_tmp_0);
              continue '_fun_loop
            },
            91u8 => {
              block_id = Goto::UTF8Char380B91(_tmp_0);
              continue '_fun_loop
            },
            92u8 => {
              block_id = Goto::UTF8Char380B92(_tmp_0);
              continue '_fun_loop
            },
            93u8 => {
              block_id = Goto::UTF8Char380B93(_tmp_0);
              continue '_fun_loop
            },
            94u8 => {
              block_id = Goto::UTF8Char380B94(_tmp_0);
              continue '_fun_loop
            },
            95u8 => {
              block_id = Goto::UTF8Char380B95(_tmp_0);
              continue '_fun_loop
            },
            96u8 => {
              block_id = Goto::UTF8Char380B96(_tmp_0);
              continue '_fun_loop
            },
            97u8 => {
              block_id = Goto::UTF8Char380B97(_tmp_0);
              continue '_fun_loop
            },
            98u8 => {
              block_id = Goto::UTF8Char380B98(_tmp_0);
              continue '_fun_loop
            },
            99u8 => {
              block_id = Goto::UTF8Char380B99(_tmp_0);
              continue '_fun_loop
            },
            100u8 => {
              block_id = Goto::UTF8Char380B100(_tmp_0);
              continue '_fun_loop
            },
            101u8 => {
              block_id = Goto::UTF8Char380B101(_tmp_0);
              continue '_fun_loop
            },
            102u8 => {
              block_id = Goto::UTF8Char380B102(_tmp_0);
              continue '_fun_loop
            },
            103u8 => {
              block_id = Goto::UTF8Char380B103(_tmp_0);
              continue '_fun_loop
            },
            104u8 => {
              block_id = Goto::UTF8Char380B104(_tmp_0);
              continue '_fun_loop
            },
            105u8 => {
              block_id = Goto::UTF8Char380B105(_tmp_0);
              continue '_fun_loop
            },
            106u8 => {
              block_id = Goto::UTF8Char380B106(_tmp_0);
              continue '_fun_loop
            },
            107u8 => {
              block_id = Goto::UTF8Char380B107(_tmp_0);
              continue '_fun_loop
            },
            108u8 => {
              block_id = Goto::UTF8Char380B108(_tmp_0);
              continue '_fun_loop
            },
            109u8 => {
              block_id = Goto::UTF8Char380B109(_tmp_0);
              continue '_fun_loop
            },
            110u8 => {
              block_id = Goto::UTF8Char380B110(_tmp_0);
              continue '_fun_loop
            },
            111u8 => {
              block_id = Goto::UTF8Char380B111(_tmp_0);
              continue '_fun_loop
            },
            112u8 => {
              block_id = Goto::UTF8Char380B112(_tmp_0);
              continue '_fun_loop
            },
            113u8 => {
              block_id = Goto::UTF8Char380B113(_tmp_0);
              continue '_fun_loop
            },
            114u8 => {
              block_id = Goto::UTF8Char380B114(_tmp_0);
              continue '_fun_loop
            },
            115u8 => {
              block_id = Goto::UTF8Char380B115(_tmp_0);
              continue '_fun_loop
            },
            116u8 => {
              block_id = Goto::UTF8Char380B116(_tmp_0);
              continue '_fun_loop
            },
            117u8 => {
              block_id = Goto::UTF8Char380B117(_tmp_0);
              continue '_fun_loop
            },
            118u8 => {
              block_id = Goto::UTF8Char380B118(_tmp_0);
              continue '_fun_loop
            },
            119u8 => {
              block_id = Goto::UTF8Char380B119(_tmp_0);
              continue '_fun_loop
            },
            120u8 => {
              block_id = Goto::UTF8Char380B120(_tmp_0);
              continue '_fun_loop
            },
            121u8 => {
              block_id = Goto::UTF8Char380B121(_tmp_0);
              continue '_fun_loop
            },
            122u8 => {
              block_id = Goto::UTF8Char380B122(_tmp_0);
              continue '_fun_loop
            },
            123u8 => {
              block_id = Goto::UTF8Char380B123(_tmp_0);
              continue '_fun_loop
            },
            124u8 => {
              block_id = Goto::UTF8Char380B124(_tmp_0);
              continue '_fun_loop
            },
            125u8 => {
              block_id = Goto::UTF8Char380B125(_tmp_0);
              continue '_fun_loop
            },
            126u8 => {
              block_id = Goto::UTF8Char380B126(_tmp_0);
              continue '_fun_loop
            },
            127u8 => {
              block_id = Goto::UTF8Char380B127(_tmp_0);
              continue '_fun_loop
            },
            194u8 => {
              block_id = Goto::UTF8Char380B133(_tmp_0);
              continue '_fun_loop
            },
            195u8 => {
              block_id = Goto::UTF8Char380B139(_tmp_0);
              continue '_fun_loop
            },
            196u8 => {
              block_id = Goto::UTF8Char380B145(_tmp_0);
              continue '_fun_loop
            },
            197u8 => {
              block_id = Goto::UTF8Char380B151(_tmp_0);
              continue '_fun_loop
            },
            198u8 => {
              block_id = Goto::UTF8Char380B157(_tmp_0);
              continue '_fun_loop
            },
            199u8 => {
              block_id = Goto::UTF8Char380B163(_tmp_0);
              continue '_fun_loop
            },
            200u8 => {
              block_id = Goto::UTF8Char380B169(_tmp_0);
              continue '_fun_loop
            },
            201u8 => {
              block_id = Goto::UTF8Char380B175(_tmp_0);
              continue '_fun_loop
            },
            202u8 => {
              block_id = Goto::UTF8Char380B181(_tmp_0);
              continue '_fun_loop
            },
            203u8 => {
              block_id = Goto::UTF8Char380B187(_tmp_0);
              continue '_fun_loop
            },
            204u8 => {
              block_id = Goto::UTF8Char380B193(_tmp_0);
              continue '_fun_loop
            },
            205u8 => {
              block_id = Goto::UTF8Char380B199(_tmp_0);
              continue '_fun_loop
            },
            206u8 => {
              block_id = Goto::UTF8Char380B205(_tmp_0);
              continue '_fun_loop
            },
            207u8 => {
              block_id = Goto::UTF8Char380B211(_tmp_0);
              continue '_fun_loop
            },
            208u8 => {
              block_id = Goto::UTF8Char380B217(_tmp_0);
              continue '_fun_loop
            },
            209u8 => {
              block_id = Goto::UTF8Char380B223(_tmp_0);
              continue '_fun_loop
            },
            210u8 => {
              block_id = Goto::UTF8Char380B229(_tmp_0);
              continue '_fun_loop
            },
            211u8 => {
              block_id = Goto::UTF8Char380B235(_tmp_0);
              continue '_fun_loop
            },
            212u8 => {
              block_id = Goto::UTF8Char380B241(_tmp_0);
              continue '_fun_loop
            },
            213u8 => {
              block_id = Goto::UTF8Char380B247(_tmp_0);
              continue '_fun_loop
            },
            214u8 => {
              block_id = Goto::UTF8Char380B253(_tmp_0);
              continue '_fun_loop
            },
            215u8 => {
              block_id = Goto::UTF8Char380B259(_tmp_0);
              continue '_fun_loop
            },
            216u8 => {
              block_id = Goto::UTF8Char380B265(_tmp_0);
              continue '_fun_loop
            },
            217u8 => {
              block_id = Goto::UTF8Char380B271(_tmp_0);
              continue '_fun_loop
            },
            218u8 => {
              block_id = Goto::UTF8Char380B277(_tmp_0);
              continue '_fun_loop
            },
            219u8 => {
              block_id = Goto::UTF8Char380B283(_tmp_0);
              continue '_fun_loop
            },
            220u8 => {
              block_id = Goto::UTF8Char380B289(_tmp_0);
              continue '_fun_loop
            },
            221u8 => {
              block_id = Goto::UTF8Char380B295(_tmp_0);
              continue '_fun_loop
            },
            222u8 => {
              block_id = Goto::UTF8Char380B301(_tmp_0);
              continue '_fun_loop
            },
            223u8 => {
              block_id = Goto::UTF8Char380B307(_tmp_0);
              continue '_fun_loop
            },
            224u8 => {
              block_id = Goto::UTF8Char380B322(_tmp_0);
              continue '_fun_loop
            },
            225u8 => {
              block_id = Goto::UTF8Char380B335(_tmp_0);
              continue '_fun_loop
            },
            226u8 => {
              block_id = Goto::UTF8Char380B348(_tmp_0);
              continue '_fun_loop
            },
            227u8 => {
              block_id = Goto::UTF8Char380B361(_tmp_0);
              continue '_fun_loop
            },
            228u8 => {
              block_id = Goto::UTF8Char380B374(_tmp_0);
              continue '_fun_loop
            },
            229u8 => {
              block_id = Goto::UTF8Char380B387(_tmp_0);
              continue '_fun_loop
            },
            230u8 => {
              block_id = Goto::UTF8Char380B400(_tmp_0);
              continue '_fun_loop
            },
            231u8 => {
              block_id = Goto::UTF8Char380B413(_tmp_0);
              continue '_fun_loop
            },
            232u8 => {
              block_id = Goto::UTF8Char380B426(_tmp_0);
              continue '_fun_loop
            },
            233u8 => {
              block_id = Goto::UTF8Char380B439(_tmp_0);
              continue '_fun_loop
            },
            234u8 => {
              block_id = Goto::UTF8Char380B452(_tmp_0);
              continue '_fun_loop
            },
            235u8 => {
              block_id = Goto::UTF8Char380B465(_tmp_0);
              continue '_fun_loop
            },
            236u8 => {
              block_id = Goto::UTF8Char380B478(_tmp_0);
              continue '_fun_loop
            },
            237u8 => {
              block_id = Goto::UTF8Char380B519(_tmp_0);
              continue '_fun_loop
            },
            238u8 => {
              block_id = Goto::UTF8Char380B491(_tmp_0);
              continue '_fun_loop
            },
            239u8 => {
              block_id = Goto::UTF8Char380B504(_tmp_0);
              continue '_fun_loop
            },
            240u8 => {
              block_id = Goto::UTF8Char380B541(_tmp_0);
              continue '_fun_loop
            },
            241u8 => {
              block_id = Goto::UTF8Char380B561(_tmp_0);
              continue '_fun_loop
            },
            242u8 => {
              block_id = Goto::UTF8Char380B581(_tmp_0);
              continue '_fun_loop
            },
            243u8 => {
              block_id = Goto::UTF8Char380B601(_tmp_0);
              continue '_fun_loop
            },
            244u8 => {
              block_id = Goto::UTF8Char380B623(_tmp_0);
              continue '_fun_loop
            },
            _ => {
              block_id = Goto::UTF8Char380B624(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B629(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char380B630(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UTF8Char380B629(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B628(_arg_0, _tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char380B631(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char380B630(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char380B626(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _ManyBody_455(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      ManyBody455B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::ManyBody455B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::ManyBody455B0(_arg_0) => {
          _state.push(true, "./WB001.ddl:54:44--54:51:UTF8Char_");
          return super::WB001::UTF8Char_(_state, _arg_0)
        },
      }
    }
  }

  enum __CallRec456<'result> {
    Many456(
      ddl::Input,
      &'result mut std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>>,
    ),
  }

  fn __call_rec456<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec456<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany456(
        &'result mut std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>>,
      ),
    }
    enum Goto {
      Many456B0(ddl::Input),
      Many456B1(ddl::Input),
      Many456B2(bool, ddl::Input),
      Many456B4(ddl::Input),
      Many456B5(ddl::Unit, ddl::Input),
      Many456B6(ddl::Input),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec456::Many456(fa0, __result) => {
          __stack.push(Frame::DoneMany456(__result));
          Goto::Many456B6(fa0)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many456B0(_arg_0) => {
          _state.push(true, ":Many_456");
          block_id = Goto::Many456B6(_arg_0);
          continue '_fun_loop
        },
        Goto::Many456B1(_arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany456(__output) => {
              __output.write(ddl::ParserResult::Ok(ddl::Unit, _arg_0));
              return;
            },
          }
        },
        Goto::Many456B2(_arg_0, _arg_1) => {
          match _arg_0 {
            false => {
              block_id = Goto::Many456B1(_arg_1);
              continue '_fun_loop
            },
            true => { block_id = Goto::Many456B0(_arg_1); continue '_fun_loop },
          }
        },
        Goto::Many456B4(_arg_0) => {
          block_id = Goto::Many456B2(false, _arg_0);
          continue '_fun_loop
        },
        Goto::Many456B5(_arg_0, _arg_1) => {
          block_id = Goto::Many456B2(true, _arg_1);
          continue '_fun_loop
        },
        Goto::Many456B6(_arg_0) => {
          _state.push(false, ":ManyBody_455");
          let _tmp_0 = _arg_0.bor().clo();
          match super::WB001::_ManyBody_455(_state, _tmp_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Many456B5(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Many456B4(_arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              match __stack.into_iter().next().unwrap() {
                Frame::DoneMany456(__output) => {
                  __output.write(ddl::ParserResult::Exception);
                  return;
                },
              }
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_456(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result: std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>> =
      std::mem::MaybeUninit::uninit();
    __call_rec456(_state, __CallRec456::Many456(fa0, &mut __result));
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn _Only__381(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Only381B0(ddl::Input),
      Only381B1(ddl::Input),
      Only381B2,
      Only381B3(ddl::Unit, ddl::Input),
      Only381B4(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Only381B4(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Only381B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::Only381B1(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected leftover input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:78:35--78:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Only381B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Only381B3(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_1.bor().is_empty();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Only381B1(_arg_1);
              continue '_fun_loop
            },
            true => { block_id = Goto::Only381B0(_arg_1); continue '_fun_loop },
          }
        },
        Goto::Only381B4(_arg_0) => {
          _state.push(false, "./Daedalus.ddl:78:32--78:32:Many_456");
          match super::WB001::_Many_456(_state, _arg_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Only381B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Only381B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _LookAhead__382(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      LookAhead382B0,
      LookAhead382B1(ddl::Unit, ddl::Input, ddl::Input),
      LookAhead382B2(ddl::Input, ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::LookAhead382B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::LookAhead382B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::LookAhead382B1(_arg_0, _arg_1, _arg_2) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_2)
        },
        Goto::LookAhead382B2(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:138:7--138:7:Only__381");
          match super::WB001::_Only__381(_state, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::LookAhead382B1(x, i, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::LookAhead382B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _WithStream__383(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      WithStream383B0(ddl::Input, ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::WithStream383B0(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::WithStream383B0(_arg_0, _arg_1) => {
          _state.push(true, "./Daedalus.ddl:135:3--145:3:LookAhead__382");
          return super::WB001::_LookAhead__382(_state, _arg_0, _arg_1)
        },
      }
    }
  }

  enum __CallRec458<'result> {
    Many458(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec458<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec458<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany458(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many458B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many458B1,
      Many458B4(ddl::Input),
      Many458B6(ddl::Input, ddl::Input),
      Many458B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many458B10(ddl::Input, ddl::Input),
      Many458B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many458B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many458B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many458B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec458::Many458(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany458(__result));
          Goto::Many458B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many458B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_458");
          block_id = Goto::Many458B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many458B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany458(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many458B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany458(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many458B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:53:20--53:24",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many458B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many458B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many458B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many458B1; continue '_fun_loop },
          }
        },
        Goto::Many458B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:53:20--53:24",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many458B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many458B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many458B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many458B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many458B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many458B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many458B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many458B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany458(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many458B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many458B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many458B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_458(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec458(
      _state,
      __CallRec458::Many458(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Text(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Text384B0,
      Text384B1(ddl::Unit, ddl::Input, ddl::Array<ddl::U<8>>),
      Text384B2,
      Text384B3(ddl::Builder<ddl::U<8>>, ddl::Input),
      Text384B4,
      Text384B5(ddl::U<64>, ddl::Input),
      Text384B6(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Text384B6(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Text384B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text384B1(_arg_0, _arg_1, _arg_2) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_2, _arg_1)
        },
        Goto::Text384B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text384B3(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          let _tmp_1 = ddl::new_byte_array(b"array");
          let _tmp_5 = _tmp_0.bor().clo();
          let _tmp_2 = ddl::new_input(_tmp_1, _tmp_5);
          _state.push(false, "./WB001.ddl:54:5--54:51:WithStream__383");
          match super::WB001::_WithStream__383(_state, _arg_1, _tmp_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text384B1(x, i, _tmp_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text384B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Text384B4 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text384B5(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:53:13--53:24:Many_458");
          match super::WB001::_Many_458(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text384B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text384B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Text384B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:52:13--52:28:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_3) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text384B5(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text384B4;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  enum __CallRec465<'result> {
    Many465(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec465<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec465<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany465(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many465B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many465B1,
      Many465B4(ddl::Input),
      Many465B6(ddl::Input, ddl::Input),
      Many465B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many465B10(ddl::Input, ddl::Input),
      Many465B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many465B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many465B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many465B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec465::Many465(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany465(__result));
          Goto::Many465B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many465B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_465");
          block_id = Goto::Many465B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many465B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany465(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many465B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany465(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many465B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:61:12--61:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many465B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many465B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many465B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many465B1; continue '_fun_loop },
          }
        },
        Goto::Many465B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:61:12--61:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many465B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many465B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many465B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many465B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many465B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many465B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many465B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many465B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany465(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many465B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many465B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many465B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_465(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec465(
      _state,
      __CallRec465::Many465(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Fixed(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Fixed385B0,
      Fixed385B1(ddl::Builder<ddl::U<8>>, ddl::Input),
      Fixed385B2,
      Fixed385B3(ddl::U<64>, ddl::Input),
      Fixed385B4(ddl::Input, ddl::U<8>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Fixed385B4(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::Fixed385B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Fixed385B1(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Fixed385B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Fixed385B3(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:61:5--61:16:Many_465");
          match super::WB001::_Many_465(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Fixed385B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Fixed385B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Fixed385B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./WB001.ddl:60:13--60:32:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Fixed385B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Fixed385B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  enum __CallRec472<'result> {
    Many472(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec472<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec472<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany472(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many472B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many472B1,
      Many472B4(ddl::Input),
      Many472B6(ddl::Input, ddl::Input),
      Many472B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many472B10(ddl::Input, ddl::Input),
      Many472B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many472B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many472B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many472B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec472::Many472(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany472(__result));
          Goto::Many472B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many472B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_472");
          block_id = Goto::Many472B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many472B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany472(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many472B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany472(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many472B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:67:12--67:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many472B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many472B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many472B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many472B1; continue '_fun_loop },
          }
        },
        Goto::Many472B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:67:12--67:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many472B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many472B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many472B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many472B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many472B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many472B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many472B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many472B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany472(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many472B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many472B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many472B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_472(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec472(
      _state,
      __CallRec472::Many472(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Raw(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Raw386B0,
      Raw386B1(ddl::Builder<ddl::U<8>>, ddl::Input),
      Raw386B2,
      Raw386B3(ddl::U<64>, ddl::Input),
      Raw386B4(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Raw386B4(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Raw386B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Raw386B1(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Raw386B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Raw386B3(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:67:5--67:16:Many_472");
          match super::WB001::_Many_472(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Raw386B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Raw386B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Raw386B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:66:13--66:28:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_3) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Raw386B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Raw386B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn Header_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Header387B0(ddl::Input, bool),
      Header387B1(ddl::Input, ddl::U<32>, ddl::U<32>),
      Header387B2(ddl::Input),
      Header387B3,
      Header387B4(ddl::U<32>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header387B6(ddl::Array<ddl::U<8>>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header387B7(ddl::Input, ddl::U<8>),
      Header387B8(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Header387B8(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Header387B0(_arg_1, _arg_0) => {
          _state.push(true, "./WB001.ddl:46:5--46:29:Guard_");
          return super::Daedalus::Guard_(_state, _arg_1, _arg_0)
        },
        Goto::Header387B1(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= _arg_1;
          block_id = Goto::Header387B0(_arg_2, _tmp_0);
          continue '_fun_loop
        },
        Goto::Header387B2(_arg_0) => {
          block_id = Goto::Header387B0(_arg_0, false);
          continue '_fun_loop
        },
        Goto::Header387B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header387B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_2 <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Header387B2(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header387B1(_arg_1, _arg_0, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::Header387B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:45:13--45:20:BEUInt32");
          match super::Daedalus::BEUInt32(_state, _tmp_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header387B4(x, i, _arg_2, _arg_3);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header387B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header387B7(_arg_1, _arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ _arg_0 ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:44:6--44:16",
              _arg_1.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header387B8(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = ddl::new_array([ _arg_1 ]);
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Header387B7(_arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header387B6(_tmp_0, _arg_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn Word(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Word388B0,
      Word388B1(ddl::Unit, ddl::Input),
      Word388B2(ddl::Input, ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Word388B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::Word388B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Word388B1(_arg_0, _arg_1) => {
          _state.push(true, "./WB001.ddl:73:5--73:12:BEUInt64");
          return super::Daedalus::BEUInt64(_state, _arg_1)
        },
        Goto::Word388B2(_arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:72:5--72:18:Header_");
          match super::WB001::Header_(
            _state,
            _arg_0,
            _arg_1,
            <ddl::U<32>>::from(8u64),
            <ddl::U<32>>::from(8u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Word388B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Word388B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub fn Envelope(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<super::WB001::Envelope> {
    enum Goto {
      Envelope389B0,
      Envelope389B1(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope389B2,
      Envelope389B3(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::U<64>,
      ),
      Envelope389B4,
      Envelope389B5(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
      ),
      Envelope389B6,
      Envelope389B7(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope389B8,
      Envelope389B9(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope389B10,
      Envelope389B11(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope389B12,
      Envelope389B13(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
      ),
      Envelope389B14,
      Envelope389B15(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope389B16,
      Envelope389B17(ddl::Array<ddl::U<8>>, ddl::Input, ddl::Array<ddl::U<8>>),
      Envelope389B18,
      Envelope389B19(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope389B21(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope389B22(ddl::Input),
      Envelope389B24(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope389B25(ddl::Input),
      Envelope389B26(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Envelope389B26(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Envelope389B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B1(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8, _arg_9, _arg_10) => {
          let _tmp_0 =
            super::WB001::Envelope {
              domain: _arg_2,
              nonce: _arg_3,
              epoch: _arg_4,
              action: _arg_5,
              destination: _arg_6,
              capability: _arg_7,
              amount: _arg_8,
              expiry: _arg_9,
              payer: _arg_10,
              payload: _arg_0,
            };
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Envelope389B2 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B3(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8, _arg_9) => {
          _state.push(false, "./WB001.ddl:36:19--36:33:Raw");
          match super::WB001::Raw(
            _state,
            _arg_1,
            <ddl::U<8>>::from(10u64),
            <ddl::U<32>>::from(0u64),
            <ddl::U<32>>::from(4096u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B1(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_8,
                _arg_9,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B4 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B5(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8) => {
          _state.push(false, "./WB001.ddl:35:19--35:33:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(9u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(128u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B3(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_8,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B6 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B7(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7) => {
          _state.push(false, "./WB001.ddl:34:19--34:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(8u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B5(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B4;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B8 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6) => {
          _state.push(false, "./WB001.ddl:33:19--33:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(7u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B7(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B6;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B10 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B11(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5) => {
          _state.push(false, "./WB001.ddl:32:19--32:32:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(6u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(64u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B9(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B8;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B12 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B13(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          _state.push(false, "./WB001.ddl:31:19--31:33:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(5u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(128u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B11(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B10;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B14 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B15(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:30:19--30:31:Fixed");
          match super::WB001::Fixed(
            _state,
            _arg_1,
            <ddl::U<8>>::from(4u64),
            <ddl::U<32>>::from(32u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B13(x, i, _arg_2, _arg_3, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B12;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B16 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B17(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./WB001.ddl:29:19--29:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(3u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B15(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B14;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B18 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B19(_arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:28:19--28:31:Fixed");
          match super::WB001::Fixed(
            _state,
            _arg_1,
            <ddl::U<8>>::from(2u64),
            <ddl::U<32>>::from(32u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B17(x, i, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B16;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B21(_arg_0, _arg_1) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:27:19--27:32:Text");
          match super::WB001::Text(
            _state,
            _tmp_1,
            <ddl::U<8>>::from(1u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(64u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope389B19(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope389B18;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope389B22(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ <ddl::U<8>>::from(1u64) ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:26:5--26:16",
              _arg_0.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B24(_arg_0, _arg_1) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          let _tmp_2 = ddl::new_array([ <ddl::U<8>>::from(1u64) ]);
          let _tmp_3 = _tmp_1.bor().is_prefix(_tmp_2.bor());
          match _tmp_3.bor() {
            false => {
              block_id = Goto::Envelope389B22(_tmp_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Envelope389B21(_tmp_2, _tmp_1);
              continue '_fun_loop
            },
          }
        },
        Goto::Envelope389B25(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_byte_array(b"bT-WB01");
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:25:5--25:19",
              _arg_0.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope389B26(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"bT-WB01");
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Envelope389B25(_arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Envelope389B24(_tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub fn Exact(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<super::WB001::Envelope> {
    enum Goto {
      Exact390B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Exact390B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Exact390B0(_arg_0) => {
          _state.push(true, "./WB001.ddl:39:13--39:20:Envelope");
          return super::WB001::Envelope(_state, _arg_0)
        },
      }
    }
  }
}