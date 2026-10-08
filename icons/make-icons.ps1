# Draws the app icon (club crest on stadium navy) at 64, 192 and 512 px.
Add-Type -AssemblyName System.Drawing
foreach ($s in 64, 192, 512) {
  $b = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(15, 24, 48))
  $k = $s / 100.0
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddLine(50*$k, 14*$k, 78*$k, 23*$k); $p.AddLine(78*$k, 23*$k, 78*$k, 50*$k)
  $p.AddBezier(78*$k, 50*$k, 78*$k, 68*$k, 66*$k, 80*$k, 50*$k, 88*$k)
  $p.AddBezier(50*$k, 88*$k, 34*$k, 80*$k, 22*$k, 68*$k, 22*$k, 50*$k)
  $p.AddLine(22*$k, 50*$k, 22*$k, 23*$k); $p.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 35, 61))), $p)
  $g.SetClip($p); $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 184, 65))), 0, 36*$k, $s, 10*$k); $g.ResetClip()
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (2.4*$k)), $p)
  $f = New-Object System.Drawing.Font 'Arial Black', (17*$k), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $g.DrawString('CC', $f, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, (54*$k), $s, (24*$k)), $sf)
  $b.Save("$PSScriptRoot\icon-$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $b.Dispose()
}
