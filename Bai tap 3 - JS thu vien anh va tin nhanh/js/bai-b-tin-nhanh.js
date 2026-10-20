/* BÀI B — VIẾT CODE: Lọc tin và đăng tin nhanh (news.html)
   Viết code theo đặc tả.
   Không sửa news.html, không sửa css; chỉ viết JavaScript trong file này. */

// ---------- ĐÃ CHO SẴN (không sửa) ----------
// Chặn việc gửi form tìm kiếm khi nhấn Enter, để trang không bị tải lại.
document.querySelector("#searchbar form").addEventListener("submit", (e) => e.preventDefault());

// ---------- PHẦN BẠN VIẾT ----------

const oTimKiem = document.getElementById("o-tim-kiem");
const danhSach = document.getElementById("list");
const boDem = document.getElementById("bo-dem");
const khongThay = document.getElementById("khong-thay");
const tinTieuDe = document.getElementById("tin-tieu-de");
const tinNoiDung = document.getElementById("tin-noi-dung");
const nutDang = document.getElementById("nut-dang");
const baoLoi = document.getElementById("bao-loi");

// F1. Bộ đếm "Đang hiển thị x/y tin" trong #bo-dem.
// F2 + F3. Lọc tin khi gõ vào #o-tim-kiem (sự kiện keyup) và thông báo #khong-thay.
function locTin() {
	const tuKhoa = oTimKiem.value;
	const tuKhoaThuong = tuKhoa.toLowerCase();
	const cacMuc = danhSach.querySelectorAll("li");
	let soHien = 0;

	for (const muc of cacMuc) {
		const tieuDe = muc.querySelector("h3").textContent.toLowerCase();
		const noiDung = muc.querySelector("p").textContent.toLowerCase();
		if (tieuDe.includes(tuKhoaThuong) || noiDung.includes(tuKhoaThuong)) {
			muc.classList.remove("an");
			soHien++;
		} else {
			muc.classList.add("an");
		}
	}

	boDem.textContent = `Đang hiển thị ${soHien}/${cacMuc.length} tin`;

	if (soHien === 0) {
		khongThay.classList.remove("an");
		khongThay.textContent = `Không tìm thấy tin nào cho "${tuKhoa}"`;
	} else {
		khongThay.classList.add("an");
	}
}

locTin();
oTimKiem.addEventListener("keyup", locTin);

// F4. Nút "Read more >>" / "Thu gọn <<" — MỘT trình lắng nghe đặt trên #list.
danhSach.addEventListener("click", (e) => {
	if (!e.target.classList.contains("more")) {
		return;
	}
	const doanVan = e.target.parentNode.querySelector("p");
	doanVan.classList.toggle("day-du");
	e.target.textContent = doanVan.classList.contains("day-du") ? "Thu gọn <<" : "Read more >>";
});

// F5. Nút #nut-dang: kiểm tra dữ liệu, tạo <li> mới, chèn vào đầu #list.
nutDang.addEventListener("click", () => {
	if (tinTieuDe.value === "" || tinNoiDung.value === "") {
		baoLoi.textContent = "Vui lòng nhập đủ tiêu đề và nội dung.";
		return;
	}

	const mucMoi = document.createElement("li");

	const thoiGian = document.createElement("span");
	thoiGian.className = "time";
	thoiGian.textContent = homNay();

	const tieuDe = document.createElement("h3");
	tieuDe.textContent = tinTieuDe.value;

	const noiDung = document.createElement("p");
	noiDung.textContent = tinNoiDung.value;

	const nutXemThem = document.createElement("button");
	nutXemThem.type = "button";
	nutXemThem.className = "more";
	nutXemThem.textContent = "Read more >>";

	mucMoi.append(thoiGian, tieuDe, noiDung, nutXemThem);
	danhSach.prepend(mucMoi);

	tinTieuDe.value = "";
	tinNoiDung.value = "";
	baoLoi.textContent = "";

	locTin();
});
