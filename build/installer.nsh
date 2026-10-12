!macro customInit
  ; Electron 23+ cannot start on Windows 7/8/8.1. Stop before replacing files,
  ; including when an older updater ignores minimumSystemVersion metadata.
  ${IfNot} ${AtLeastWin10}
    IfSilent +2
    MessageBox MB_OK|MB_ICONSTOP "LBRY Desktop NG requires Windows 10 or later. Your existing installation has not been changed."
    SetErrorLevel 1633
    Quit
  ${EndIf}
!macroend
